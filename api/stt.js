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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const { mimeType = 'audio/webm', data } = req.body || {};

  if (!data) {
    return res.status(400).json({ error: 'Missing audio data' });
  }

  const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';

  const candidateModels = [
    'gemini-3.5-transcribe',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
  ];

  let lastError = '';

  for (const model of candidateModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: TRANSCRIBE_PROMPT },
                  { inlineData: { mimeType: cleanMime, data } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 1000,
            },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const rawText = (json.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text || '')
          .join('')
          .trim();

        if (rawText) {
          const cleaned = rawText
            .replace(/^["'`\s]+|["'`\s]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const finalText = cleaned === 'EMPTY' ? '' : cleaned;
          return res.status(200).json({ text: finalText });
        }
      } else {
        const errText = await response.text();
        lastError = `${response.status} - ${errText}`;
      }
    } catch (e) {
      lastError = e?.message || String(e);
    }
  }

  return res.status(502).json({ error: `Gemini STT error: ${lastError}` });
}
