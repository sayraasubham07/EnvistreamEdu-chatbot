// ---- Gemini Speech-to-Text (AI mic) ----
// Chrome's free Web Speech recognizer cannot learn custom words, so it keeps
// mishearing the brand "Envistream EduSkill" differently on every try (fast,
// slow, odd pace...). When VITE_GEMINI_API_KEY is configured, we record the
// mic audio with the modern MediaRecorder and send it to the Gemini API, which
// transcribes Hindi/Hinglish accurately and keeps English brand words correct.

const GEMINI_API_KEY =
  typeof process !== "undefined" && process.env
    ? process.env.VITE_GEMINI_API_KEY || ""
    : import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY || "" : "";

const GEMINI_MODEL =
  typeof process !== "undefined" && process.env
    ? process.env.VITE_GEMINI_MODEL || "gemini-3.5-flash"
    : import.meta.env ? import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash" : "gemini-3.5-flash";

// Current active STT model
const FALLBACK_MODEL = "gemini-3.5-flash";

// Instructed very explicitly so the model acts as a transcriptor, not a chatbot.
const TRANSCRIBE_PROMPT = `
You are a Hinglish speech-to-text engine. Transcribe the audio word-for-word exactly.
STRICT RULES:
- The audio is Hindi/Hinglish (Hindi in Roman letters) with some English words.
- Output ONLY the exact transcript in Roman (English) letters. Do not summarize, do not rephrase, do not skip words, do not add words. No quotes, no explanations.
- Always spell the brand name as "Envistream EduSkill" no matter how it sounds.
- Keep English words correctly spelled: courses, internship, placement, training, provide, location.
- If there is no clear human speech, output exactly: EMPTY

Real examples of the user asking:
"Envistream EduSkill ka location kahan par hai"
"courses kya provide karte ho"
`;

export const isGeminiSTTAvailable = () => true;

// The modern mic APIs (MediaRecorder / FileReader) only exist in new browsers
export const cloudMediaSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined" &&
  typeof FileReader !== "undefined";

// ---- Recording helpers ----

// Open the mic and start recording. Returns the recorder + collected chunks.
export const startCloudRecording = async () => {
  let stream;
  try {
    // Prefer AAC (audio/mp4) — the format Gemini handles most reliably,
    // plus noise suppression & AGC so every word is captured cleanly.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        automaticGainControl: true,
        codecs: ["aac"],
      },
    });
  } catch (_) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        automaticGainControl: true,
      },
    });
  }

  // Some Chrome versions don't expose track.audioFormat — fall back safely.
  const track = stream.getAudioTracks()?.[0];
  const codec = track?.audioFormat?.codec || "opus"; // "aac" | "opus" | default
  let recorder;
  try {
    recorder = new MediaRecorder(stream, codec === "aac" ? "audio/mp4;codecs=aac" : "audio/webm;codecs=opus");
  } catch (_) {
    // Constructor with a mime can fail on old versions — let Chrome pick its default.
    recorder = new MediaRecorder(stream);
  }

  const chunks = [];
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });
  // Collect in frequent 200ms intervals so no words are dropped at the end
  recorder.start(200);
  return { stream, recorder, chunks };
};

// Stop recording and assemble the audio file (Blob).
export const stopCloudRecording = async ({ recorder, chunks, stream }) => {
  return new Promise((resolve) => {
    const handleStop = () => {
      try {
        stream?.getTracks()?.forEach((t) => t.stop());
      } catch (_) {}
      if (!chunks.length) {
        resolve(null);
      } else {
        resolve(new Blob(chunks, { type: recorder.mimeType }));
      }
    };

    if (recorder.state === "inactive") {
      handleStop();
      return;
    }

    recorder.addEventListener("stop", handleStop, { once: true });
    try {
      recorder.stop();
    } catch (_) {
      handleStop();
    }
  });
};

// ---- Transcription ----

const blobToBase64 = async (blob) => {
  let buffer;
  if (typeof blob.arrayBuffer === "function") {
    buffer = await blob.arrayBuffer();
  } else {
    buffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32 KB — safely under string limits
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

export const transcribeWithGemini = async (blob) => {
  const data = await blobToBase64(blob);
  const rawMime = blob.type || "audio/webm";
  // Gemini requires clean MIME types without codec parameters (e.g. 'audio/webm' instead of 'audio/webm;codecs=opus')
  const mimeType = rawMime.split(";")[0].trim() || "audio/webm";

  // 1. Try secure serverless /api/stt first (API key is kept 100% private)
  try {
    const res = await fetch("/api/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mimeType, data }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.text || "";
    }
  } catch (_) {
    // serverless route unavailable, try direct fallback
  }

  const call = async (model) => {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: TRANSCRIBE_PROMPT },
              { inlineData: { mimeType, data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1000,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  };

  // Normalize model name helper
  const normalizeModel = (m) => {
    if (!m) return "gemini-3.5-flash";
    if (m === "gemini-3.5") return "gemini-3.5-flash";
    if (m === "gemini-3.6") return "gemini-3.6-flash";
    if (m === "gemini-3.7") return "gemini-3.7-flash";
    return m;
  };

  // If the initial model fails, retry with verified active models
  const candidateModels = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
  ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

  let lastStatus = 0;
  let lastBody = "";

  for (const model of candidateModels) {
    try {
      const { ok, status, body } = await call(model);
      if (ok) {
        const json = JSON.parse(body);
        const rawText = (json.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text || "")
          .join("")
          .trim();
        const text = rawText
          .replace(/^["'`]|["'`]$/g, "")
          .replace(/\*\*/g, "")
          .trim();
        return text === "EMPTY" ? "" : text;
      }
      lastStatus = status;
      lastBody = body;
      console.warn(`Gemini STT with model "${model}" failed (${status}) — trying next candidate...`);
    } catch (e) {
      console.warn(`Gemini STT network error on "${model}":`, e);
    }
  }

  throw new Error(`Gemini STT error ${lastStatus}: ${lastBody.slice(0, 300)}`);
};