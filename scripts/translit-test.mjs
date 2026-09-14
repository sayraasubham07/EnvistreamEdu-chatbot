// Quick verification of toEnglishLetters() inside src/components/chat/Chat.jsx
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../src/components/chat/Chat.jsx"), "utf8");

// Extract the transliteration block (INDIC_* tables + toEnglishLetters fn)
const start = source.indexOf("const INDIC_CONSONANTS");
const end = source.indexOf("// ---- End transliteration ----");
const block = source.slice(start, end > start ? end : undefined).split("const GROQ_API_KEY")[0];
const toEnglishLetters = new Function(`${block}; return toEnglishLetters;`)();

const tests = [
  ["लोकेशन कहां पर है", "lokeshan kahan par hai"],
  ["नमस्ते", "namaste"],
  ["मैं हूँ सायरा", "main hun sayara"],
  ["क्या हाल है", "kya hal hai"],
  ["नहीं, मुझे नहीं पता", "nahin, mujhe nahin pata"],
  ["hello कैसे हो", "hello kaise ho"],
  ["धन्यवाद!", "dhanyavad!"],
  ["आप कौन से कोर्स चलाते हो?", "aap kaun se kors chalate ho?"],
];

let pass = 0;
for (const [input, expected] of tests) {
  const got = toEnglishLetters(input);
  const ok = got === expected;
  if (ok) pass++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${input}  ->  ${got}${ok ? "" : `   (expected: ${expected})`}`);
}
console.log(`${pass}/${tests.length} passed`);
