// ---- Gemini Neural Text-to-Speech (sweet female voice) ----
// Sayraa's English greetings & replies are spoken with Google's neural TTS
// voices (Gemini 2.5 Flash TTS -> Gemini 2.5 Pro TTS) instead of the robotic
// browser SAPI voices, so the greeting sounds like a sweet young woman instead
// of the default/male system voice. The caller falls back to the browser Web
// Speech API whenever this returns false (no key, network error, autoplay...).

const TTS_API_KEY =
  typeof process !== "undefined" && process.env
    ? process.env.VITE_GEMINI_API_KEY || ""
    : import.meta.env ? import.meta.env.VITE_GEMINI_API_KEY || "" : "";

// Model chain: Gemini 2.5 Flash TTS (fast) first, Gemini 2.5 Pro TTS second.
const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];

// Sweet FEMALE prebuilt voices, sweetest first:
// Aoede = breezy & warm, Leda = youthful & sweet, Kore = firm & clear, Zephyr = bright.
const TTS_VOICES = ["Aoede", "Leda", "Kore", "Zephyr"];

export const neuralTtsAvailable = () => Boolean(TTS_API_KEY);

let currentAudio = null;

// Cooldown after a 429 so we stop hammering a rate-limited API (free-tier
// TTS quota) and fall back to Web Speech immediately instead of retrying.
// Persisted in sessionStorage so a page reload doesn't reset it and start
// earning 429s all over again.
let ttsCooldownUntil = 0;
const COOLDOWN_KEY = "sayraaTtsCooldownUntil";
try {
  ttsCooldownUntil = parseInt(sessionStorage.getItem(COOLDOWN_KEY) || "0", 10) || 0;
} catch (_) {
  /* sessionStorage unavailable — in-memory cooldown still works */
}
const setCooldownUntil = (ms) => {
  ttsCooldownUntil = ms;
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(ms));
  } catch (_) {
    /* ignore */
  }
};

// Stop any neural audio currently playing (called before every new speech).
export const stopGeminiSpeech = () => {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch (_) {
      /* ignore */
    }
    currentAudio = null;
  }
};

const parseSampleRate = (mimeType) => {
  const m = /rate=(\d+)/.exec(mimeType || "");
  return m ? parseInt(m[1], 10) : 24000;
};

// Gemini TTS returns RAW PCM samples (audio/L16) — wrap them in a WAV header
// so a plain <audio> element can play them in every browser.
const pcmToWavBlob = (base64, sampleRate) => {
  const binary = atob(base64);
  const pcm = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) pcm[i] = binary.charCodeAt(i);

  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const writeAscii = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);             // fmt chunk size
  view.setUint16(20, 1, true);              // PCM format
  view.setUint16(22, 1, true);              // mono
  view.setUint32(24, sampleRate, true);     // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (16-bit mono)
  view.setUint16(32, 2, true);              // block align
  view.setUint16(34, 16, true);             // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, pcm.length, true);
  new Uint8Array(buffer, 44).set(pcm);

  return new Blob([buffer], { type: "audio/wav" });
};

const synthesize = async (text, lang) => {
  const style =
    lang === "hi"
      ? "Read the following Hinglish (Hindi written in Roman letters) text exactly as written, with a warm, sweet, gentle, friendly FEMALE voice. Do not translate, add, or remove any words."
      : "Read the following text exactly as written, with a warm, sweet, gentle, friendly FEMALE voice. Do not add or remove any words.";

  // - A thrown error (timeout/network) stops the chain immediately: if the
  //   fast model can't reach us, waiting again for the next one only delays
  //   the fallback voice. Only a fast HTTP error (!ok) tries the next combo.
  // - A 429 means the free-tier quota is exhausted — back off for 10 minutes.
  for (const model of TTS_MODELS) {
    for (const voice of TTS_VOICES) {
      try {
        const controller = new AbortController();
        // Audio synthesis can take several seconds — the old 6s timeout was
        // throwing away VALID neural audio, which is why the choppy browser
        // voice kept taking over mid-greeting.
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(TTS_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${style}\n\nText: ${text}` }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                  },
                },
              },
            }),
          }
        );
        clearTimeout(timeout);

        if (response.status === 429) {
          // Free-tier quota exhausted — back off instead of spamming the API
          // (every extra attempt only earns more 429s and more delay).
          setCooldownUntil(Date.now() + 10 * 60 * 1000);
          console.warn(
            "Gemini TTS rate-limited (429) — using the browser female voice for the next 10 minutes."
          );
          return null;
        }
        if (!response.ok) continue; // bad voice/model — try the next one
        const data = await response.json();
        const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
        if (part?.inlineData?.data) {
          return pcmToWavBlob(part.inlineData.data, parseSampleRate(part.inlineData.mimeType));
        }
      } catch (_) {
        // Timeout / network failure — don't try more combinations (more
        // waiting = worse delay), let the caller fall back right away.
        return null;
      }
    }
  }
  return null;
};

// Synthesize `text` and play it. Resolves true once audio is actually
// playing, false when the caller should fall back to Web Speech.
export const playGeminiSpeech = async (text, lang = "en") => {
  if (!TTS_API_KEY || !text) return false;
  // Known 429 — skip instantly and let the caller's Web Speech voice carry it.
  if (Date.now() < ttsCooldownUntil) return false;
  stopGeminiSpeech();

  const blob = await synthesize(text, lang);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;

  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
    };
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    // Both events mean audio has actually started.
    audio.addEventListener("playing", () => finish(true), { once: true });
    audio.addEventListener("play", () => finish(true), { once: true });
    audio.addEventListener(
      "error",
      () => {
        cleanup();
        finish(false);
      },
      { once: true }
    );
    audio.addEventListener("ended", cleanup);

    // If playback never STARTS (autoplay policy etc.), fall back — but NEVER
    // kill audio that is already playing. The old check chopped the neural
    // voice mid-sentence ("break break words") and then let a second voice
    // restart from the beginning on top of it.
    setTimeout(() => {
      if (settled) return;
      if (!audio.paused && audio.currentTime > 0) {
        finish(true); // it IS playing — just settle late
        return;
      }
      try {
        audio.pause();
      } catch (_) {
        /* ignore */
      }
      cleanup();
      finish(false);
    }, 2500);

    audio.play().catch(() => {
      cleanup();
      finish(false);
    });
  });
};
