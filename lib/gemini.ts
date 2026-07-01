// lib/gemini.ts
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function geminiGenerateContent(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY  // sin NEXT_PUBLIC_ — solo servidor
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 800 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}