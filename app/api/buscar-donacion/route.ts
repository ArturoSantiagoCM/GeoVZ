// app/api/buscar-donacion/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || !body.consulta || !body.reportes || !Array.isArray(body.reportes)) {
      return NextResponse.json(
        { error: 'Parámetros inválidos. Se requiere "consulta" y "reportes".' },
        { status: 400 }
      )
    }

    const { consulta, reportes } = body

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la configuración de la API Key.' }, { status: 500 })
    }


// Minimizamos el payload: Gemini solo necesita el ID y la descripción para evaluar
const datosParaIA = reportes
  .map((r: any) => ({
    id: (r.id || '').toString(),
    descripcion: (r.descripcion || '').trim()
  }))
  // Le agregamos la estructura clara al parámetro 'item' para que TypeScript no se queje
  .filter((item: { id: string; descripcion: string }) => item.descripcion.length > 0)
    
  const prompt = `Actúas como un filtro inteligente para un mapa de ayuda humanitaria en Venezuela.
Analiza las descripciones de los lugares y determina cuáles necesitan insumos relacionados con la búsqueda: "${consulta}".

Usa criterio semántico amplio (ej. si busca "medicamentos", incluye lugares que pidan "pastillas", "paracetamol", "antibióticos", "gasas", "suero").

DATOS DE LOS LUGARES (JSON):
${JSON.stringify(datosParaIA)}

TAREA:
1. Devuelve SOLO los "id" de los lugares cuya descripción coincida con la búsqueda.
2. Genera una lista de hasta 3 artículos complementarios generales que se sugiera donar basados en la necesidad global.

DEBES RESPONDER EXCLUSIVAMENTE ESTE FORMATO JSON (sin markdown, sin bloques de código):
{
  "idsCoincidentes": ["id1", "id2"],
  "recomendaciones": ["artículo1", "artículo2"]
}`

    const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'
    
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 800,
          responseMimeType: "application/json" // Fuerza salida JSON limpia sin ```json
        }
      })
    })

    if (!res.ok) {
      const errTxt = await res.text()
      console.error('Error de Gemini:', errTxt)
      return NextResponse.json({ error: 'La IA no pudo procesar la solicitud.' }, { status: 502 })
    }

    const data = await res.json()
    const textoJson = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    try {
      const resultadoEstable = JSON.parse(textoJson.trim())
      return NextResponse.json(resultadoEstable)
    } catch (err) {
      console.error('Error parseando JSON de Gemini:', textoJson)
      return NextResponse.json({ error: 'Formato de respuesta inválido.' }, { status: 500 })
    }

  } catch (error) {
    console.error('Error en servidor:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
