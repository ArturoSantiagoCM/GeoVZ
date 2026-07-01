// app/api/buscar-donacion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Reporte } from '@/types'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function extraerItems(desc: string): string[] {
  return desc
    .split(/\n|,|;/)
    .map(l => l.replace(/^[-•*·\s]+/, '').trim())
    .filter(l => l.replace(/[.\s]/g, '').length > 3)
}

export async function POST(req: NextRequest) {
  try {
    const { consulta, reportes }: { consulta: string; reportes: Reporte[] } = await req.json()

    if (!consulta?.trim()) {
      return NextResponse.json({ error: 'Consulta vacía' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
    }

    const payload = reportes
      .filter(r => (r.descripcion ?? '').replace(/[.\-\s•*]/g, '').length > 3)
      .map(r => ({ id: r.id, items: extraerItems(r.descripcion!) }))
      .filter(r => r.items.length > 0)

    if (payload.length === 0) {
      return NextResponse.json({ coincidencias: [], recomendaciones: [] })
    }

    const prompt = `Sos un asistente de ayuda humanitaria. El usuario quiere donar: "${consulta}".

Tenés esta lista de lugares con sus ítems de necesidad:
${JSON.stringify(payload)}

TAREA:
1. Para cada lugar, indicá cuáles ítems de su lista están relacionados con "${consulta}". Si ningún ítem está relacionado, no incluyas ese lugar.
2. Basándote SOLO en los ítems que aparecen en los datos (no inventes nada), sugerí hasta 3 artículos adicionales que el donante podría llevar que complementen su donación de "${consulta}" y que aparezcan en algún lugar de los datos.

REGLAS CRÍTICAS:
- Solo incluí ítems que existan EXACTAMENTE en los datos proporcionados.
- No inferás, no inventes, no agregues nada que no esté escrito en los datos.
- Si ningún lugar tiene ítems relacionados con "${consulta}", devolvé coincidencias: [].
- Las recomendaciones deben ser ítems que realmente aparezcan en algún lugar de los datos.

Respondé SOLO con este JSON (sin markdown, sin texto extra):
{
  "coincidencias": [
    { "reporteId": "id-del-lugar", "items": ["ítem relacionado 1"] }
  ],
  "recomendaciones": ["ítem complementario 1", "ítem complementario 2"]
}`

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
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Error de Gemini' }, { status: 500 })
    }

    const data = await res.json()
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const limpio = texto.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(limpio)

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('Error en buscar-donacion:', err)
    return NextResponse.json({ error: 'Error al procesar la búsqueda' }, { status: 500 })
  }
}
