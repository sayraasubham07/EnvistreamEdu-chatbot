import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./chat.module.css";
import Picker from "emoji-picker-react";
import eduskillLogo from "../../assets/img/suulogo-round.png";
import chatBg from "../../assets/img/chat_bg.webp";
import { fixPhonetics } from "./phoneticFixes";
import { isGeminiSTTAvailable, cloudMediaSupported, startCloudRecording, stopCloudRecording, transcribeWithGemini } from "./geminiStt";

// Pick the clearest available Hindi voice (female preferred) for TTS.
// Ranked so high-quality "Natural"/"Online"/Google voices win over the
// legacy robotic SAPI voices (e.g. Microsoft Hemant) that Chrome/Edge
// otherwise return first — that legacy fallback is what made the female
// voice sound unclear.
const getSweetHindiVoice = (synth) => {
  const voices = synth.getVoices().filter(
    (v) =>
      v.lang === "hi-IN" ||
      (v.lang && v.lang.startsWith("hi")) ||
      v.name.includes("हिन्दी")
  );
  if (!voices.length) return null;

  const score = (v) => {
    const n = v.name.toLowerCase();
    let s = 0;
    // High-quality neural/online voices are far clearer than legacy SAPI ones
    if (n.includes("natural") || n.includes("online")) s += 8;
    if (n.includes("google")) s += 6;
    // Known female Hindi voices (Microsoft Swara, Microsoft Kalpana, Google हिन्दी)
    if (n.includes("swara") || n.includes("kalpana")) s += 4;
    if (n.includes("female") || v.gender === "female") s += 4;
    // Legacy robotic male voices — deprioritise (last-resort only)
    if (n.includes("hemant") || n.includes("madhur")) s -= 5;
    return s;
  };

  return voices.sort((a, b) => score(b) - score(a))[0];
};

// ---- Audio feedback tone when mic opens ----
// Plays a tiny subtle chime so the user knows the mic is listening,
// replacing the old spoken "Sun rahi hoon" which collided with the mic.
const playListenTone = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 250);
  } catch (_) {
    // AudioContext blocked or not supported — silent fail
  }
};

// ---- Devanagari → English letters (Hinglish) transliteration ----
// The browser recognizer ("hi-IN") writes Hinglish speech in Devanagari
// (e.g. "कोर्सेज क्या प्रोवाइड करते हो"). The chat should show/send it in
// English letters ("korsej kya provaaid karte ho"), so we transliterate it
// ourselves. This keeps recognition accurate while always displaying
// Hinglish text.
const INDIC_CONSONANTS = {
  // Devanagari (Hindi)
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
  "ष": "sh", "स": "s", "ह": "h", "ळ": "l", "़": "",
};
const INDIC_VOWELS = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऋ": "ri",
  "ऑ": "o", "ऍ": "e",
};
const INDIC_MATRAS = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ॉ": "o", "ॅ": "e",
};
const INDIC_VIRAMAS = ["्"];
const INDIC_ANUSVARAS = ["ं", "ँ"];

const toEnglishLetters = (text) => {
  if (!text) return text;
  // Normalise nukta clusters first (ज़→ज, ड़→ड, ...) so they map cleanly
  const src = text
    .replace(/क़/g, "क").replace(/ख़/g, "ख").replace(/ग़/g, "ग")
    .replace(/ज़/g, "ज").replace(/ड़/g, "ड").replace(/ढ़/g, "ढ")
    .replace(/फ़/g, "फ").replace(/य़/g, "य");

  let out = "";
  let inherentAIndex = -1; // position of the implicit "a" after a consonant

  const dropInherentA = () => {
    if (inherentAIndex === out.length - 1) out = out.slice(0, -1);
    inherentAIndex = -1;
  };

  for (const ch of src) {
    if (INDIC_CONSONANTS[ch] !== undefined) {
      out += INDIC_CONSONANTS[ch] + "a";
      inherentAIndex = out.length - 1;
    } else if (INDIC_VIRAMAS.includes(ch)) {
      // Halant kills the implicit "a" (क् = "k" not "ka")
      dropInherentA();
    } else if (INDIC_MATRAS[ch]) {
      // Vowel sign replaces the implicit "a" (का = "ka" not "kaa"... etc.)
      dropInherentA();
      out += INDIC_MATRAS[ch];
    } else if (INDIC_VOWELS[ch]) {
      out += INDIC_VOWELS[ch];
      inherentAIndex = -1;
    } else if (INDIC_ANUSVARAS.includes(ch)) {
      out += "n";
      inherentAIndex = -1;
    } else if (ch === "ः") {
      out += "h";
      inherentAIndex = -1;
    } else if (ch === "।" || ch === "॥") {
      dropInherentA();
      out += ".";
    } else {
      // Spaces, punctuation, Latin letters etc. end the current word
      dropInherentA();
      out += ch;
    }
  }
  dropInherentA(); // word ends at end of string
  return out;
};
// ---- End transliteration ----

// ---- Hinglish-only language rule ----
// Sayraa ALWAYS replies in Hinglish (Hindi written in English/Roman letters),
// no matter which language the user uses.
const HINGLISH_LANGUAGE_INSTRUCTION = `IMPORTANT LANGUAGE RULE: ALWAYS reply in HINGLISH — Hindi written in English (Roman) letters, e.g. 'aap kaise ho', 'main aapki kya madad kar sakti hoon'. NEVER use Devanagari script and NEVER reply in pure English — even if the user writes in pure English or Hindi (Devanagari). Understand both English and Hindi inputs, but your reply must ALWAYS be Hinglish written in English letters only.`;

const GEMINI_API_KEY =
  typeof process !== "undefined" && process.env
    ? process.env.VITE_GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || ""
    : import.meta.env
    ? import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.REACT_APP_GEMINI_API_KEY || ""
    : "";

const Chat = () => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [interimText, setInterimText] = useState("");

  const chatEndRef = useRef(null);
  const navigate = useNavigate();
  const isListeningRef = useRef(false);
  // While listening, this holds a function that finalises & sends early
  const stopEarlyRef = useRef(null);
  // Ensures the welcome message is spoken only once even in StrictMode dev
  const welcomeSpokenRef = useRef(false);
  // Cloud (Gemini) mic session + silence-watch interval
  const cloudRecRef = useRef(null);
  const sensingTimerRef = useRef(null);

  // NOTE: A FRESH SpeechRecognition instance is created on EVERY mic press
  // inside startListening(). Reusing a single instance created on mount is
  // unreliable in Chrome — after the first use it often silently stops
  // recognizing speech (this was the bug where the mic heard nothing).

  // Speak a reply in Hinglish with the clearest Hindi female voice.
  const speakText = useCallback((text) => {
    if (typeof window === 'undefined') return;

    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn("Speech synthesis not available.");
      return;
    }
    // Cancel any ongoing speech immediately to avoid delays
    synth.cancel();

    // Keep emojis on screen, but NEVER read them aloud ("smiling face" etc.)
    const spokenText = text
      .replace(/Sayraa/gi, "Sigh-raa")
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu,
        ""
      )
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!spokenText) return;

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = "hi-IN";
    utterance.rate = 1;    // normal pace — clear & natural
    utterance.pitch = 1.2; // mildly feminine without sounding muffled

    const hindiVoice = getSweetHindiVoice(synth);
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    } else {
      console.warn("Hindi female voice not found, using default hi-IN voice.");
    }

    synth.speak(utterance);
  }, []);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem("sayraaMessages");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    const synth = window.speechSynthesis;
    if (synth) {
      synth.onvoiceschanged = () => {
        console.log("Voices loaded:", synth.getVoices());
      };
    }

  }, []);

  const medConfig = {
    identity: {
      name: "Sayraa",
      creator: "Envistream EduSkill",
      gender: "female",
      language: "Hinglish",
      age: 20,
      location: "Bhubaneswar, India",
      traits: ["knowledgeable", "friendly", "professional", "helpful", "playful"],
      capabilities: [
        "Course & training information 📚",
        "Internship program guidance 💼",
        "Enrollment help ✍️",
        "Placement & career support 🎯",
        "Project guidance 🛠️",
        "Contact & location info 📍",
      ],
    },
    systemMessage: `Act as Sayraa, the official chatbot of Envistream EduSkill (www.envistream.org) — an IT training and internship institute in Bhubaneswar, Odisha. You:
      1. Answer questions ONLY about Envistream EduSkill: its training programs, courses, internships, projects, placement support, benefits, enrollment process, and contact details.
      2. ALWAYS respond in HINGLISH (Hindi written in English letters) — never in pure English and never in Devanagari script.
      3. Maintain a friendly yet professional tone.
      4. KEEP ANSWERS SHORT: maximum 2-4 short lines. Never write long paragraphs or big lists.
      5. For "courses kya hai" type questions, reply with just the course names in 1-2 lines (comma separated). Give full details ONLY when the user asks about ONE specific course.
      6. For location questions, reply ONLY with the address in 1-2 lines. Do NOT include phone number or call instructions unless specifically asked for contact/calling details.

      KNOWLEDGE BASE (Envistream EduSkill - www.envistream.org):
      - About: Envistream EduSkill provides training and internship programs for students and freshers. As per the new AICTE and BPUT model syllabus, internship is now a mandatory part of the curriculum. Envistream EduSkill helps students gain professional experience and understand corporate work culture.
      - IT Training / CSE Programs: Software Testing (manual + automation testing for QA), Cypress Automation (web automation with Cypress and JavaScript), ERP/SAP Training, SAP Testing, Web Development (HTML, CSS, JavaScript, jQuery, Bootstrap), Node.js & React.js (full-stack web apps), Digital Marketing (AI SEO, SEM, social media), Artificial Intelligence, PHP (with Laravel), Python, Java.
      - BBA/MBA Programs: Digital Marketing, SEO Training, Social Media Marketing, Market Research, Business Development, Lead Generation.
      - Projects offered: PHP projects (e.g., Chatbot for Students, College Admission Prediction System), Web Development projects (e.g., One-Page Layout, Product Landing Page), Python projects (e.g., Mad Libs Generator, Number Guessing, Hangman), Java projects (e.g., Airline Reservation System, Course Management System).
      - Benefits: Technical workshops, virtual & classroom training, 24x7 lab facility, experienced trainers with top MNC background, live project experience, technical placement assistance, campus placement program, HR & job preparation training, mock interviews by external panel, real-time HR interviews, daily doubt-clearing classes.
      - Why internship matters: real experience, self-discovery, networking, resume boost, job readiness.
      - Contact: Plot-N6/454, 2nd floor, Saffire Building, Opposite- Crown Hotel, IRC Village, Nayapalli, Bhubaneswar, Odisha. Phone: +91 7873489364 / +91 9078419012. Email: training@envistream.org / internshipenvistream@gmail.com. Website: www.envistream.org

      STRICT RULES:
      - VOICE INPUT: user messages often come from a speech recognizer and contain PHONETIC spelling mistakes (e.g. 'veyar is d lokeshan oph inglish medisin' means 'Where is the location of Envistream EduSkill'; 'korsej kya provaaid karte ho' means 'Courses kya provide karte ho'; 'in vhich strim hedar skil ka location kahan par hai' means 'Envistream EduSkill ka location kahan par hai'; 'edaministreshan ka location kahan par hai' means 'Envistream EduSkill ka location kahan par hai' (listened fast); 'sarita oto skil ka location kahan par hai' means 'Envistream EduSkill ka location kahan par hai' (listened slow)). Always silently interpret such misspelled words as the intended Envistream EduSkill terms and answer normally — never comment on the spelling.
      - If the user asks ANY question NOT related to Envistream EduSkill (random topics, general knowledge, health, movies, jokes, homework, coding help, etc.), politely refuse with exactly this reply (in Hinglish): "Mein Envistream EduSkills ka chatbot hun, mera ye sab kaam nehi hai! 😅 Courses, training ya internships ke baare mein kuchh poochhna hai?"
      - Never answer off-topic questions, even if you know the answer.
      - When asked "tumhe kon banaya hai" respond: "Mujhe Envistream EduSkill ki team ne banaya hai 🧑‍💻"

      Examples:
      User: "Courses kya hai?"
      Response: "Software Testing, Cypress Automation, ERP/SAP, Web Development, Node.js & React.js, Digital Marketing, AI, PHP, Python, Java. Kisi ek course ki detail chahiye? 😊"

      User: "Who is the PM of India?"
      Response: "Mein Envistream EduSkills ka chatbot hun, mera ye sab kaam nehi hai! 😅 Courses, training ya internships ke baare mein kuchh poochhna hai?"

      User: "Location kya hai?"
      Response: "Plot-N6/454, 2nd floor, Saffire Building, Opposite- Crown Hotel, IRC Village, Nayapalli, Bhubaneswar, Odisha. 😊"

      User: "Internship kaise paun?"
      Response: "www.envistream.org pe Enroll Now pe click karo ya call karo +91 7873489364 pe. 😊"`,
  };

  useEffect(() => {
    const welcomeText = "Namaste! Mein hoon Sayraa, Envistream EduSkill ka chatbot. Courses, training aur internships ke baare mein poochho! 😊";
    const initialMessages = [{
      text: welcomeText,
      sender: "ai",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }];
    setMessages(initialMessages);

    const initialHistory = [
      {
        role: "model",
        parts: [{ text: welcomeText }],
      },
    ];
    setConversationHistory(initialHistory);

    const hindiWelcome = "नमस्ते! मैं हूँ सायरा, Envistream EduSkill का चैटबॉट। कोर्स, ट्रेनिंग और इंटर्नशिप के बारे में पूछो! 😊";
    // Speak the welcome only ONCE — React.StrictMode runs effects twice in
    // dev, which would otherwise speak it twice
    if (!welcomeSpokenRef.current) {
      welcomeSpokenRef.current = true;
      speakText(hindiWelcome);
    }
  }, [speakText]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("sayraaMessages", JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

// ================== AI mic (Gemini cloud speech-to-text) ==================
  // Stops the recorder, sends the audio to Gemini and sends the transcript.
  // Used both by the auto-silence detector and by pressing the mic again.
  const releaseCloudListen = () => {
    isListeningRef.current = false;
    setIsListening(false);
    setInterimText("");
  };

  const finalizeCloud = async () => {
    const session = cloudRecRef.current;
    if (!session) return;
    cloudRecRef.current = null;

    if (sensingTimerRef.current) {
      clearInterval(sensingTimerRef.current);
      sensingTimerRef.current = null;
    }
    stopEarlyRef.current = null;

    // Keep the listening state ON so the "mein samajh rahi hoon..." bubble shows
    setInterimText(" mein samajh rahi hoon... 🤖");

    let blob;
    try {
      blob = await stopCloudRecording(session);
    } catch (_) {
      releaseCloudListen();
      return;
    }

    if (!blob || blob.size < 1000) {
      releaseCloudListen();
      setMessages((prev) => [
        ...prev,
        { text: "Kuch sunai nahi diya... mic ke paas aake thoda aur clearly bolo na! 🎙️", sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      return;
    }

    let transcript = "";
    try {
      transcript = await transcribeWithGemini(blob);
    } catch (err) {
      console.error("Gemini STT error:", err);
      releaseCloudListen();
      let errorText = "AI mic me problem aayi! Dobara try karo ya message likh do. ⌨️😊";
      const details = String(err?.message || "");
      if (/401|403|400/.test(details)) {
        errorText = "Gemini API key problem hai! .env mein VITE_GEMINI_API_KEY check karo. 🔑";
      } else if (/429/.test(details)) {
        errorText = "Thodi der ruko! Gemini free limit full ho gayi, 1 min baad try karo. ⏳";
      }
      setMessages((prev) => [
        ...prev,
        { text: errorText, sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      return;
    }

    releaseCloudListen();

    // Same phonetic safety net as the browser mic, in case Gemini slips
    const text = fixPhonetics(transcript);
    if (text && text.trim()) sendMessage(text.trim());
  };

  const beginCloudRecognition = async () => {
    isListeningRef.current = true;
    setIsListening(true);
    setInterimText("");

    let session;
    try {
      session = await startCloudRecording();
    } catch (err) {
      console.error("Cloud mic error:", err);
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText("");
      setMessages((prev) => [
        ...prev,
        { text: "Mic start nahi ho paya! Browser mic permission do aur fir se try karo. 🎙️", sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      return;
    }

    cloudRecRef.current = session;
    playListenTone();
    stopEarlyRef.current = finalizeCloud;

    // Fast Voice Activity Detection (VAD) with standard Web Audio API
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error("AudioContext not supported");

      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(session.stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastSound = Date.now();
      let hasSpoken = false;

      sensingTimerRef.current = setInterval(() => {
        if (!cloudRecRef.current) {
          if (sensingTimerRef.current) clearInterval(sensingTimerRef.current);
          try { audioCtx.close(); } catch (_) {}
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        // Human voice detection threshold (sensitive to soft speech and end of words)
        if (avg > 10) {
          hasSpoken = true;
          lastSound = Date.now();
        }

        // Full sentence pause threshold: 2.0s silence after speaking, or 6s before first word
        const silenceThreshold = hasSpoken ? 2000 : 6000;
        if (Date.now() - lastSound > silenceThreshold) {
          if (sensingTimerRef.current) clearInterval(sensingTimerRef.current);
          try { audioCtx.close(); } catch (_) {}
          finalizeCloud();
        }
      }, 100);

      // Max recording cap for long queries: 25 seconds
      setTimeout(() => {
        if (cloudRecRef.current) finalizeCloud();
      }, 25000);
    } catch (_) {
      // Fallback timer if AudioContext blocked: 8 seconds
      setTimeout(() => {
        if (cloudRecRef.current) finalizeCloud();
      }, 8000);
    }
  };

  const startListening = () => {
    // Pressing the mic AGAIN while listening stops early & sends what was heard
    if (isListeningRef.current) {
      if (stopEarlyRef.current) stopEarlyRef.current();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // IMPORTANT: Stop any ongoing speech BEFORE opening the mic,
    // otherwise the bot's own voice gets picked up by recognition
    // and it fails to understand the user.
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // ---- AI (Gemini) live transcription — the accurate path ----
    // When an API key is configured and the modern mic APIs exist, we record
    // the audio and let Gemini transcribe it. This keeps the "Envistream
    // EduSkill" brand name and other English words correct no matter how fast
    // or slow the user speaks.
    if (isGeminiSTTAvailable() && cloudMediaSupported()) {
      beginCloudRecognition();
      return;
    }

    if (!SpeechRecognition) {
      setMessages((prev) => [
        ...prev,
        { text: "Is browser me speech recognition supported nahi hai! Chrome ya Edge browser use karo. 🎙️", sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      return;
    }

    isListeningRef.current = true;
    setIsListening(true);
    setInterimText("");

    // Single-pass Hinglish recognition with the Hindi (hi-IN) engine.
    const beginRecognition = (isRetry = false) => {
      // Create a FRESH instance every time — reusing an old instance after
      // it has ended is unreliable in Chrome (mic stops recognizing words).
      const recognition = new SpeechRecognition();
      // continuous = true keeps the mic open for the WHOLE sentence.
      // With continuous = false Chrome finalised the FIRST word at the first
      // small pause and the bot answered immediately — that was the bug.
      recognition.continuous = true;
      recognition.interimResults = true; // live transcription while speaking
      recognition.lang = "hi-IN";
      // Ask for alternatives so we can keep the MOST CONFIDENT transcription
      // of each chunk — noticeably better accuracy for Hinglish words.
      recognition.maxAlternatives = 3;

      let gotResult = false;
      let hadError = false;
      let audioStarted = false;
      let finalTranscript = ""; // everything recognised so far (whole sentence)
      let silenceTimer = null;
      let sent = false;

      // Finalise: stop the mic and send the complete sentence
      const sendTranscript = () => {
        if (sent) return;
        sent = true;
        if (silenceTimer) clearTimeout(silenceTimer);
        stopEarlyRef.current = null;
        isListeningRef.current = false;
        setIsListening(false);
        setInterimText("");
        try { recognition.stop(); } catch (_) { /* already stopped */ }
        // Transliterate to Roman letters, then fix common phonetic mishearings
        // (e.g. "inglish medisin" -> "Envistream EduSkill") before sending.
        const raw = toEnglishLetters(finalTranscript.replace(/\s+/g, " ").trim());
        const text = fixPhonetics(raw);
        if (text) sendMessage(text);
      };

      // Keep listening while you talk; wait ~2 seconds of silence
      // before auto-sending so the speaker is never cut off mid-thought.
      // (The user can also tap the mic icon again to send immediately.)
      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(sendTranscript, 2000);
      };
      stopEarlyRef.current = sendTranscript;

      recognition.onaudiostart = () => {
        audioStarted = true;
      };

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            gotResult = true;
            // Among the alternatives, keep the one Chrome is MOST confident
            // about (falls back to the first when no confidence is given).
            let best = result[0];
            for (let j = 1; j < result.length; j++) {
              if ((result[j].confidence || 0) > (best.confidence || 0)) {
                best = result[j];
              }
            }
            // Accumulate — do NOT send yet, the sentence may continue
            finalTranscript += best.transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        // Show live transcription (in English letters) of everything heard so far
        const liveText = toEnglishLetters(
          (finalTranscript + " " + interim).replace(/\s+/g, " ").trim()
        );
        if (liveText) setInterimText(liveText);
        // Still hearing speech → keep waiting for the rest of the sentence
        resetSilenceTimer();
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        hadError = true;
        sent = true; // don't auto-send after an error
        if (silenceTimer) clearTimeout(silenceTimer);
        stopEarlyRef.current = null;

        isListeningRef.current = false;
        setIsListening(false);
        setInterimText("");

        // Ignore 'aborted' — it happens when we cancel recognition ourselves
        if (event.error === "aborted") return;

        let errorText = "Oops! Speech samajh nahi aaya, fir se bolo na...";
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          errorText = "Mic permission blocked hai! Address bar ke 🔒 icon pe click karke microphone ALLOW karo, page reload karo. 🎙️";
        } else if (event.error === "no-speech") {
          errorText = "Kuch sunai nahi diya... mic ke paas aake thoda aur clearly bolo na! 🎙️";
        } else if (event.error === "network") {
          errorText = "Network problem hai! Speech recognition ke liye internet chahiye. 📶";
        } else if (event.error === "audio-capture") {
          errorText = "Mic detect nahi hua! Microphone connect karo aur fir se try karo. 🎙️";
        } else if (event.error === "language-not-supported") {
          errorText = "Ye browser ye language recognize nahi kar pa raha! Chrome ka naya version try karo. 🎙️";
        }

        setMessages((prev) => [
          ...prev,
          { text: errorText, sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
        ]);
      };

      recognition.onend = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        // Chrome sometimes ends the session by itself (silence cut-off) —
        // send whatever full sentence we managed to hear
        if (!sent && gotResult && finalTranscript.trim()) {
          sendTranscript();
          return;
        }
        stopEarlyRef.current = null;
        isListeningRef.current = false;
        setIsListening(false);
        setInterimText("");

        if (gotResult || hadError) return;

        if (!audioStarted) {
          // Recognition ended BEFORE the mic even opened. This happens when
          // the bot's text-to-speech was still holding the audio channel.
          // Retry once silently instead of showing an error to the user.
          if (!isRetry) {
            console.warn("Recognition ended before audio start — retrying...");
            isListeningRef.current = true; // block new presses while retrying
            setTimeout(() => beginRecognition(true), 400);
          } else {
            setMessages((prev) => [
              ...prev,
              { text: "Mic start nahi ho paya! Ek baar fir se 🎤 dabao.", sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
            ]);
          }
        }
        // Heard silence → stay quiet, no message
      };

      recognition.start();
      isListeningRef.current = true;
      setIsListening(true);
      playListenTone();
    };

    // Open the mic immediately with a gentle chime tone.
    // We NO LONGER speak "Sun rahi hoon! Bol na" first because:
    //  1. The bot speaking delayed the mic, making users talk too early
    //     (their first words were cut off or not recorded).
    //  2. Chrome's TTS audio channel collided with the mic recognizer,
    //     causing missed words and distorted transcripts.
    //  3. A quick chime tone provides instant feedback that the mic is ON.
    beginRecognition();
  };

  const onEmojiClick = (emojiObject) => {
    setUserInput((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const deleteAllMessages = () => {
    if (window.confirm("Kya aap sach mein saare messages delete karna chahte ho?")) {
      setMessages([]);
      setConversationHistory([]);
      localStorage.removeItem("sayraaMessages");
      const clearMessage = `Saare messages delete ho gaye! Main nayi shuruaat ke liye taiyaar hoon! 😊`;
      setMessages([{ text: clearMessage, sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      speakText(clearMessage, "hi");
    }
  };

  const handleQuickReply = (query) => {
    setUserInput(query);
    sendMessage(query);
  };

  const sendMessage = async (input = userInput) => {
    if (!input.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newMessages = [...messages, { text: input, sender: "user", timestamp }];
    setMessages(newMessages);
    setUserInput("");
    setIsTyping(true);

    try {

      // Sayraa ALWAYS replies in Hinglish — no per-message language branching
      const languageInstruction = HINGLISH_LANGUAGE_INSTRUCTION;

      // Build contents array for Gemini API
      const geminiContents = [
        ...conversationHistory.map((msg) => ({
          role: msg.role === "model" ? "model" : "user",
          parts: msg.parts,
        })),
        {
          role: "user",
          parts: [{ text: input }],
        },
      ];

      // Call Gemini API with automatic model quota fallback
      const chatCandidateModels = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
      ];

      let aiText = "";
      let lastChatError = "";

      for (const model of chatCandidateModels) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: `${medConfig.systemMessage}\n\n${languageInstruction}` }],
                },
                contents: geminiContents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 350,
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            aiText = data.candidates?.[0]?.content?.parts
              ?.map((p) => p.text || "")
              .join("")
              .trim();
            if (aiText) break;
          } else {
            const errorText = await response.text();
            lastChatError = `${response.status} - ${errorText}`;
            console.warn(`Chat model "${model}" returned ${response.status} — trying next model...`);
          }
        } catch (e) {
          console.warn(`Network error with model "${model}":`, e);
        }
      }

      if (!aiText) throw new Error(`Gemini API Error: ${lastChatError}`);

      // Sayraa replies are always Hinglish (Roman script) — display as-is
      const displayText = aiText;

      setConversationHistory((prev) => [
        ...prev,
        { role: "user", parts: [{ text: input }] },
        { role: "model", parts: [{ text: aiText }] },
      ]);

      setMessages((prev) => [
        ...prev,
        { text: displayText, sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);

      // Speak the Hinglish reply with the sweet Hindi female voice for
      // correct pronunciation (speakText also strips emojis & fixes names)
      speakText(aiText, "hi");
    } catch (error) {
      console.error("API Error:", error);
      const errorMessage = `Oops! Main samajh nahi payi, ek baar fir se bolo na... 😅`;
      setMessages((prev) => [
        ...prev,
        { text: errorMessage, sender: "ai", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      speakText(errorMessage, "hi");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        <img src={eduskillLogo} alt="Envistream EduSkill" className={styles.avatar} />
        <div className={styles.headerInfo} onClick={() => navigate('/')} style={{ cursor: 'pointer', flex: 1 }}>
          <span className={styles.headerTitle}>Sayraa</span>
          <span className={styles.headerSubtitle}>Your AI Guide to Learning, Internships & Careers</span>
        </div>
        <button onClick={deleteAllMessages} className={styles.deleteButton} title="Clear Chat">
          🗑️
        </button>
      </div>
      <div 
        id="chatBox" 
        className={styles.chatBox}
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.85), rgba(30, 27, 75, 0.85)), url(${chatBg})`
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={styles[`${msg.sender}-message`]}
            data-timestamp={msg.timestamp}
          >
            {msg.text}
            <span className={styles.timestamp}>{msg.timestamp}</span>
          </div>
        ))}
        {isTyping && <div className={styles.typing}>Typing...</div>}
        {isListening && <div className={styles.typing}>🎙️ {interimText || "sun rahi hoon, bolte jao..."}</div>}
        <div ref={chatEndRef} />
      </div>

      <div className={styles.footer}>
        <div className={styles.inputWrapper}>
          <span
            className={styles.smileyIcon}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            😊
          </span>
          {showEmojiPicker && (
            <div className={styles.emojiPicker}>
              <Picker onEmojiClick={onEmojiClick} />
            </div>
          )}
          <input
            id="userInput"
            type="text"
            placeholder="Apna message likho..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            className={styles.inputField}
          />
          {userInput.trim() ? (
            <button
              id="sendButton"
              onClick={() => sendMessage()}
              className={styles.sendButton}
            >
              <span role="img" aria-label="send">➡️</span>
            </button>
          ) : (
            <button
              id="micButton"
              onClick={startListening}
              className={`${styles.micButton} ${isListening ? styles.micButtonListening : ""}`}
              title={isListening ? "Sun rahi hoon! Click karke turant send karo 🎙️" : "Voice input ke liye click karo 🎤"}
            >
              {isListening ? "🎙️" : "🎤"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;