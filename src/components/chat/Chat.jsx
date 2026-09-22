import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./chat.module.css";
import Picker from "emoji-picker-react";
import eduskillLogo from "../../assets/img/suulogo-round.png";
import chatBg from "../../assets/img/chat_bg.webp";
import { fixPhonetics } from "./phoneticFixes";
import { isGeminiSTTAvailable, cloudMediaSupported, startCloudRecording, stopCloudRecording, transcribeWithGemini } from "./geminiStt";


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


const getSweetEnglishVoice = (synth) => {
  const voices = synth.getVoices().filter(
    (v) =>
      v.lang === "en-US" ||
      v.lang === "en-GB" ||
      (v.lang && v.lang.startsWith("en"))
  );
  if (!voices.length) return null;

  const isKnownFemale = (n) =>
    n.includes("female") ||
    n.includes("zira") || n.includes("samantha") ||
    n.includes("aria") || n.includes("jenny") || n.includes("michelle") ||
    n.includes("ava") || n.includes("emma") || n.includes("natasha") ||
    n.includes("sonia") || n.includes("libby") || n.includes("humaira") ||
    n.includes("microsoft anna") ||
    n.includes("microsoft helen") || n.includes("microsoft hazel") ||
    n.includes("microsoft susan") || n.includes("microsoft tifaine") ||
    n.includes("google us english") || n.includes("google uk english") ||
    n.includes("google en");

  const score = (v) => {
    const n = v.name.toLowerCase();
    let s = 0;
    // High-quality neural/online voices are far clearer than legacy SAPI ones
    if (n.includes("natural") || n.includes("online")) s += 8;
    if (n.includes("google")) s += 6;
    // Known sweet FEMALE voices (Google female, Microsoft neural female, classic female)
    if (isKnownFemale(n) || v.gender === "female") s += 5;
    // Prefer en-US over other English variants for consistency
    if (v.lang === "en-US") s += 2;
    // Legacy robotic MALE voices — deprioritise (last-resort only)
    if (n.includes("david") || n.includes("henry") || n.includes("mark") ||
        n.includes("guy") || n.includes("ryan") || n.includes("eric") ||
        n.includes("gordon") || n.includes("benjamin") || n.includes("william") ||
        n.includes("andrew") || n.includes("brian") || n.includes("jonathan") ||
        n.includes("steven") || (n.includes("male") && !n.includes("female")) ||
        (n.includes("microsoft") && !isKnownFemale(n))) s -= 5;
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

const ADAPTIVE_LANGUAGE_INSTRUCTION = `IMPORTANT LANGUAGE RULE — reply in the SAME language the user used:
- If the user's message is in ENGLISH (English words, English grammar), reply in PURE ENGLISH.
- If the user's message is in HINGLISH (Hindi words written in Roman/English letters, e.g. "kya haal hai", "courses kya provide karte ho"), reply in HINGLISH ONLY — Hindi in Roman letters, never Devanagari.
- Detect the language from the user's actual message text and match it. Do NOT force Hinglish when the user wrote English, and do NOT reply in English when the user wrote Hinglish.
- Always answer in the same language as the latest user message in the conversation.`;

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

  // ---- Voices ready promise ----
  // Chrome loads speech voices asynchronously — getVoices() often returns []
  // on first call. We wait for the onvoiceschanged event (or a short timeout)
  // so getSweetEnglishVoice / getSweetHindiVoice always see a populated list.
  // NOTE: declared BEFORE speakText because speakText lists it as a dependency.
  const voicesReadyRef = useRef(null);
  const waitForVoices = useCallback(() => {
    if (voicesReadyRef.current) return voicesReadyRef.current;
    const synth = window.speechSynthesis;
    if (!synth) {
      voicesReadyRef.current = Promise.resolve();
      return voicesReadyRef.current;
    }
    // If voices are already populated, resolve immediately
    if (synth.getVoices().length > 0) {
      voicesReadyRef.current = Promise.resolve();
      return voicesReadyRef.current;
    }
    voicesReadyRef.current = new Promise((resolve) => {
      const onVoicesChanged = () => {
        if (synth.getVoices().length > 0) {
          synth.removeEventListener("voiceschanged", onVoicesChanged);
          // Give the browser a tick to finish populating
          setTimeout(resolve, 50);
        }
      };
      synth.addEventListener("voiceschanged", onVoicesChanged);
      // Safety timeout: if voices never load, resolve anyway after 3s
      setTimeout(() => {
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        resolve();
      }, 3000);
    });
    return voicesReadyRef.current;
  }, []);

  // Speak a reply. Accepts an optional `lang` param ("en" | "hi") so the
  // welcome message can be spoken in English while Hinglish replies keep the
  // sweet Hindi female voice.
  const speakText = useCallback(async (text, lang = "hi") => {
    if (typeof window === 'undefined') return;

    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn("Speech synthesis not available.");
      return;
    }
    // Cancel any ongoing speech immediately
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

    // Wait for voices to be loaded so our voice picker sees a populated list.
    // This fixes the bug where the default (often male) voice was used because
    // getVoices() returned [] at speak time.
    await waitForVoices();

    const utterance = new SpeechSynthesisUtterance(spokenText);

    if (lang === "en") {
      // English greeting/replies use the SAME sweet female voice as the
      // Hinglish replies (Google/Microsoft Hindi female — Swara/Kalpana/
      // Google हिन्दी) speaking the English text exactly as written (the
      // text stays pure English — never Hinglish). Those Hindi female voices
      // pronounce English words with a warm Indian accent, which is exactly
      // what makes the Hinglish greeting sound so sweet. Same rate/pitch as
      // the Hinglish branch for an identical tone. Only if no Hindi voice
      // exists do we fall back to the ranked English female picker (never male).
      utterance.rate = 1;    // original "previous" pace — clear & natural
      utterance.pitch = 1.2; // original "previous" sweet feminine tone
      utterance.lang = "en-US";

      const sweetVoice = getSweetHindiVoice(synth) || getSweetEnglishVoice(synth);
      if (sweetVoice) {
        utterance.voice = sweetVoice;
        utterance.lang = sweetVoice.lang || "en-US";
      } else {
        console.warn("No preferred female voice found, using default en-US voice.");
      }
    } else {
      // Hinglish reply — use the clearest Hindi female voice
      utterance.lang = "hi-IN";
      utterance.rate = 1;    // normal pace — clear & natural (original setting)
      utterance.pitch = 1.2; // mildly feminine without sounding muffled (original setting)

      const hindiVoice = getSweetHindiVoice(synth);
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      } else {
        console.warn("Hindi female voice not found, using default hi-IN voice.");
      }
    }

    // Chrome can stutter or drop words when speak() fires in the same tick
    // as a previous cancel() — give the engine one beat before speaking.
    await new Promise((r) => setTimeout(r, 150));
    synth.speak(utterance);
  }, [waitForVoices]);

  // Load messages from localStorage on mount + detect voices
  useEffect(() => {
    const savedMessages = localStorage.getItem("sayraaMessages");
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    const synth = window.speechSynthesis;
    if (synth) {
      // Pre-warm: if voices already available, resolve the promise
      if (synth.getVoices().length > 0) {
        if (!voicesReadyRef.current) {
          voicesReadyRef.current = Promise.resolve();
        }
      }
      synth.onvoiceschanged = () => {
        console.log("Voices loaded:", synth.getVoices().map(v => `${v.name} (${v.lang})`));
      };
    }
  }, []);

  // Stop all speech/audio when the chat unmounts (page change, clear, etc.)
  useEffect(() => () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
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
    systemMessage: `Act as Sayraa, a smart and friendly AI learning guide at Envistream EduSkill (an IT training and internship institute in Bhubaneswar, Odisha).

      CORE BEHAVIOR RULES:
      1. LANGUAGE: Sayraa detects whether the user is writing in English or Hinglish (Hindi in Roman letters) and replies in the SAME language. The language rule is injected per-message by the client — do NOT force any single language here.
      2. BRANDING & NO SALES CTAs (CRITICAL):
         - In the FIRST reply/interaction of the chat, mention "Envistream EduSkill" naturally (e.g., "Envistream EduSkill mein...").
         - In SUBSEQUENT chat messages, it is NOT necessary to repeat "Envistream EduSkill" in every chat! Speak naturally using "hum", "hamare yahan", or answer directly without repeating the brand name every time.
         - NEVER add call-to-action (CTA) slogans like "detail ke liye Enquire Now dabayein! 🚀", "Enroll Now pe click karein", "Apply Now dabayein", etc. Do NOT tell the user to click buttons or enquire.
         - DO NOT append phone numbers (+91 7873489364), website links (www.envistream.org), or sales pitches ("call karein...", "visit karein...") to everyday answers. Mention phone numbers or website ONLY when the user explicitly asks for contact info, calling, registration, or admission.
      3. EXPLAINING TECH CONCEPTS ("X kya hai"):
         - When the user asks what a technology or course topic is (e.g. "PHP kya hai", "Python kya hota hai", "Software testing kya hai", "React kya hai"):
           * Step 1: Explain simply and clearly in 1-2 lines what that technology is and where it is used.
           * Step 2: In 1 short line, mention that practical training and live project internship is available (use "Envistream EduSkill" in the first chat, and "hamare yahan" in subsequent chats).
           * Example for first chat "PHP kya hai": "PHP ek popular server-side scripting language hai jo dynamic websites aur web apps banane ke liye use hoti hai. Envistream EduSkill mein iska Laravel ke sath practical training aur live project internship available hai. Iske baare mein aur jaanna hai? 😊"
           * Example for follow-up "Python kya hai": "Python ek versatile programming language hai jo AI, data science aur web development mein use hoti hai. Hamare yahan iska bhi complete practical training aur live project internship available hai. 😊"
      4. KEEP ANSWERS SHORT & NATURAL: Maximum 2-3 short lines. Never write marketing pitches, CTA slogans, or big paragraphs.
      5. For "courses kya hai" type questions, reply with just the course names in 1-2 lines (comma separated). Give full details ONLY when the user asks about ONE specific course.
      6. For location questions, reply ONLY with the address in 1-2 lines. Do NOT include phone number or call instructions unless specifically asked for contact/calling details.
      7. VOICE INPUT: user messages often come from a speech recognizer and contain PHONETIC spelling mistakes (e.g. 'korsej kya provaaid karte ho' = 'Courses kya provide karte ho'; 'lokeshan kahan hai' = 'Location kahan hai'). Silently understand the intended meaning and answer normally.
      8. OFF-TOPIC: If the user asks completely unrelated topics (movies, politics, cricket, jokes, cooking), politely refuse: "Main courses, training aur internships ke baare mein guide karti hoon! Iske related kuchh poochhna hai? 😊"
      9. When asked "tumhe kon banaya hai" respond: "Mujhe Envistream EduSkill ki team ne banaya hai 🧑‍💻"

      KNOWLEDGE BASE:
      - IT Training / CSE Programs: Software Testing (manual + automation testing for QA), Cypress Automation (web automation with Cypress and JavaScript), ERP/SAP Training, SAP Testing, Web Development (HTML, CSS, JavaScript, jQuery, Bootstrap), Node.js & React.js (full-stack web apps), Digital Marketing (AI SEO, SEM, social media), Artificial Intelligence, PHP (with Laravel), Python, Java.
      - BBA/MBA Programs: Digital Marketing, SEO Training, Social Media Marketing, Market Research, Business Development, Lead Generation.
      - Projects offered: PHP projects (e.g., Chatbot for Students, College Admission Prediction System), Web Development projects (e.g., One-Page Layout, Product Landing Page), Python projects (e.g., Games, Automation apps), Java projects (e.g., Airline Reservation System, Course Management System).
      - Benefits: Technical workshops, 24x7 lab facility, experienced trainers from top MNCs, live project experience, placement assistance, mock interviews.
      - Location: Plot-N6/454, 2nd floor, Saffire Building, Opposite- Crown Hotel, IRC Village, Nayapalli, Bhubaneswar, Odisha.
      - Contact (give ONLY when asked): Phone: +91 7873489364 / +91 9078419012. Email: training@envistream.org. Website: www.envistream.org

      Examples:
      User (First chat): "PHP kya hai?"
      Response: "PHP ek popular server-side scripting language hai jo dynamic websites aur web applications banane ke liye use hoti hai. Envistream EduSkill mein iska Laravel ke sath live project training aur internship available hai. Iske baare mein aur jaanna hai? 😊"

      User: "Courses kya hai?"
      Response: "Software Testing, Cypress Automation, Web Development, PHP (Laravel), Python, Java, Node.js & React.js, Digital Marketing & AI, aur ERP/SAP. Kisi ek course ki detail chahiye? 😊"

      User: "Location kya hai?"
      Response: "Plot-N6/454, 2nd floor, Saffire Building, Opposite- Crown Hotel, IRC Village, Nayapalli, Bhubaneswar, Odisha. 😊"

      User: "Internship kaise paun?"
      Response: "Aap humari website www.envistream.org par enroll kar sakte hain ya call karein +91 7873489364 pe! 😊"`,
  };

  useEffect(() => {
    const welcomeText = "Hello! I'm Sayraa, the AI assistant of Envistream EduSkill. Ask me about courses, training, internships, projects, placements, or career guidance! 😊";
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

    // Speak the welcome message in English (chat opens in English)
    const englishWelcome = "Hello! I'm Sayraa, the AI assistant of Envistream EduSkill. Ask me about courses, training, internships, projects, placements, or career guidance!";
    // Speak the welcome only ONCE — React.StrictMode runs effects twice in
    // dev, which would otherwise speak it twice
    if (!welcomeSpokenRef.current) {
      welcomeSpokenRef.current = true;
      speakText(englishWelcome, "en");
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

      // Sayraa replies in the SAME language as the user (English ↔ Hinglish)
      const languageInstruction = ADAPTIVE_LANGUAGE_INSTRUCTION;

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

      let aiText = "";
      let lastChatError = "";
      let serverError = "";
      let directError = "";
      const deadlineStart = Date.now();
      const timeLeft = () => 15000 - (Date.now() - deadlineStart); // global cap: nothing waits longer than 15s total

      // 1. Serverless /api/chat and the direct Gemini call run CONCURRENTLY —
      // the first successful answer wins. Running them in parallel (instead of
      // one after the other) removes the stacked-wait delay that made replies
      // feel slow; each side has its own short timeout so a hang can't pile up.
      const serverPromise = (async () => {
        try {
          const chatController = new AbortController();
          const chatTimeout = setTimeout(() => chatController.abort(), Math.min(7000, timeLeft()));
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: chatController.signal,
            body: JSON.stringify({
              systemInstruction: `${medConfig.systemMessage}\n\n${languageInstruction}`,
              contents: geminiContents,
            }),
          });
          clearTimeout(chatTimeout);

          if (response.ok) {
            const data = await response.json();
            return (data.text || "").trim();
          }
          const errData = await response.json().catch(() => ({}));
          serverError = errData.error || `${response.status} - ${response.statusText}`;
        } catch (e) {
          serverError = e?.message || String(e);
        }
        return "";
      })();

      // 2. Direct Gemini call (client-side, GEMINI_API_KEY required).
      // Speed rules:
      //  - thinking disabled (thinkingBudget 0) on thinking-capable models —
      //    biggest latency win on Gemini 3.x (lite models must NOT get it: 400)
      //  - short per-model timeout + global deadline so hanging requests can't stack
      //  - ONE quick retry only for fast 429/5xx answers (temporary spikes);
      //    never after a timeout — a hung request would just hang again.
      const directPromise = GEMINI_API_KEY
        ? (async () => {
            const chatCandidateModels = [
              "gemini-3.5-flash-lite",
              "gemini-flash-lite-latest",
              "gemini-3.8-flash",
              "gemini-3.6-flash",
              "gemini-3.5-flash",
            ];
            let sawBusyResponse = false;
            let attempts = 0;

            const callModel = async (model, timeoutMs) => {
              const modelController = new AbortController();
              const modelTimeout = setTimeout(() => modelController.abort(), timeoutMs);
              try {
                const response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: modelController.signal,
                    body: JSON.stringify({
                      systemInstruction: {
                        parts: [{ text: `${medConfig.systemMessage}\n\n${languageInstruction}` }],
                      },
                      contents: geminiContents,
                      generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 250,
                        // Lite models are NON-thinking models — sending thinkingConfig
                        // makes them return 400 INVALID_ARGUMENT (verified live).
                        ...(/lite/i.test(model)
                          ? {}
                          : { thinkingConfig: { thinkingBudget: 0 } }),
                      },
                    }),
                  }
                );
                if (response.ok) {
                  const data = await response.json();
                  const text = data.candidates?.[0]?.content?.parts
                    ?.map((p) => p.text || "")
                    .join("")
                    .trim();
                  if (text) return text;
                  directError = "Empty response from model";
                  return "";
                }
                const errorText = await response.text();
                directError = `${response.status} - ${errorText}`;
                if (response.status === 429 || response.status >= 500) sawBusyResponse = true;
                console.warn(`Chat model "${model}" returned ${response.status} — trying next model...`);
                return "";
              } catch (e) {
                directError =
                  e?.name === "AbortError"
                    ? `timeout after ${timeoutMs}ms on ${model}`
                    : e?.message || String(e);
                console.warn(`Chat model "${model}": ${directError}`);
                return "";
              } finally {
                clearTimeout(modelTimeout);
              }
            };

            for (const model of chatCandidateModels) {
              if (timeLeft() < 2500) break; // global deadline too close — stop
              const timeout = attempts === 0 ? 7000 : 4000;
              const text = await callModel(model, Math.min(timeout, timeLeft()));
              attempts++;
              if (text) return text;
            }

            if (sawBusyResponse && timeLeft() > 3500) {
              await new Promise((r) => setTimeout(r, 600)); // brief spike pause
              return callModel(chatCandidateModels[0], Math.min(6000, timeLeft()));
            }
            return "";
          })()
        : null;

      // First success wins. An empty string becomes a rejection so we keep
      // waiting for the other path instead of settling on a failed one.
      const settle = (p) => p.then((t) => (t ? Promise.resolve(t) : Promise.reject(new Error("empty"))));
      const runners = [settle(serverPromise)];
      if (directPromise) runners.push(settle(directPromise));
      try {
        aiText = await Promise.any(runners);
      } catch {
        aiText = ""; // every path failed — fall through to the error below
      }
      lastChatError = directError || serverError || lastChatError || "No response";

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

      // Speak the reply in the SAME language it was written in.
      // English replies use an English voice; Hinglish replies use the Hindi voice.
      const replyStart = aiText.trim().slice(0, 60);
      // If the reply contains Devanagari chars or common Hindi words in Roman script,
      // treat it as Hinglish; otherwise treat it as English.
      const hasDevanagari = /[ऀ-ॿ]/.test(replyStart);
      const hasHindiWords = /(kya|kaise|kaisi|kaun|kyun|kab|kahan|koi|kuchh|batao|bataiye|haan|nahi|hi|ka|ki|kon|mera|tera|hum|hamare|yahan|wahan|hai|ho|hain|karna|karo|chahiye|hoge|raha|hui|rahi|bole|batayein|jaanna|jaana|puchho|puchiye|samjha|samjhein)/i.test(replyStart);
      const isEnglishReply = !hasDevanagari && !hasHindiWords;
      speakText(aiText, isEnglishReply ? "en" : "hi");
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