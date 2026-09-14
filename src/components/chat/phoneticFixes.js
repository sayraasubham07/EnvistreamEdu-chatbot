// ---- Voice transcript clean-up (phonetic fixes) ----
// Chrome's hi-IN recognizer mishears ENGLISH words spoken with a Hindi accent —
// especially the brand name "Envistream EduSkill". Examples: "Where is the
// location of Envistream EduSkill" may come back as "veyar is d lokeshan oph
// inglish medisin" (normal pace), as "edaministreshan ka location..." (fast),
// or as "sarita oto skil ka location..." (slow). These fuzzy regex fixes run on
// the mic transcript BEFORE it is sent, so Sayraa understands the intended
// words. (Typed text is NOT touched — only mic transcripts go through this.)

const PHONETIC_FIXES = [
  // Brand name spoken as one phrase: "inglish medisin", "envistram eduskil",
  // "in vhich strim hedar skil", "in witch stream heder skill"...
  [/\b(en?vi?str?[aemuy]*m?|ingl[ei]sh|inb[ei]str[aemuy]*|in (v?hich|which|witch) str[ei]?a?m)\s+(medisin|medicin|edu?sk?il+|udiskil|aduskil|yudiskil|sk?il+|hed[ae]r skil|hed[ae]r skill|hed[ae]rskil|hed[ae] skil|ed[ae]r skil)\b/gi,
    "Envistream EduSkill"],
  // Brand name halves heard separately
  [/\b(en?vi?str?[aemuy]*m?|ingl[ei]sh|inb[ei]str[aemuy]*|in (v?hich|which|witch) str[ei]?a?m)\b/gi, "Envistream"],
  [/\b(medisin|medicin|edu?sk?il+|udiskil|aduskil|yudiskil|hed[ae]r skil|hed[ae]r skill|hed[ae]rskil|hed[ae] skil|ed[ae]r skil)\b/gi, "EduSkill"],
  // Brand name heard as ONE jumbled word when spoken fast
  // (Chrome hears it like "administration"): edaministreshan...
  [/\b(e?daministreshan|e?dministreshan|a?daministreshan|administreshan|admenistreshan|edmenistreshan)\b/gi,
    "Envistream EduSkill"],
  // Brand name heard as THREE odd words when spoken slowly: "sarita oto skil"
  [/\b(s[ae]?rita|sareeta|saritha|serita)\s+(o?t+[oa]?|auto)\s+(sk?il+)\b/gi,
    "Envistream EduSkill"],
  // Common question & domain words
  [/\b(veyar|vehar|vahar|vhere|wehar|wher|vher)\b/gi, "where"],
  [/\b(loka?sh?an|lokeshan|lokesan|lokashan|lokasion|lokasan)\b/gi, "location"],
  [/\b(cources|korsij|korsej|corsas|korsas|kors)\b/gi, "courses"],
  [/\b(intern\s?ship|inturnship|enternship)\b/gi, "internship"],
  [/\b(plas?ment|plesment|placemant)\b/gi, "placement"],
  [/\b(tre?ning|tren?ing)\b/gi, "training"],
  [/\b(prova?id|provaaid|pravaaid|pravaid)\b/gi, "provide"],
  [/\b(kya\s+pravaaid|kya\s+provaaid)\b/gi, "kya provide"],
  [/\b(karate|karte)\s+ho\b/gi, "karte ho"],
];

// Apply the phonetic fixes to a mic transcript (word-boundary safe)
export const fixPhonetics = (text) => {
  if (!text) return text;
  let out = text;
  for (const [pattern, replacement] of PHONETIC_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
};
