import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { consulta, reportes } = await request.json()

    if (!consulta || !reportes) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Falta la API Key en el servidor' }, { status: 500 })
    }

    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

    // Simplificamos los datos enviados para no saturar los tokens de Gemini
    const payload = reportes.map((r: any) => ({
      id: r.id,
      descripcion: r.descripcion || '',
      categoria: r.categoria_infraestructura || ''
    }))

    const prompt = `Actúa como un asistente de logística humanitaria para el terremoto en Venezuela. El usuario busca: "${consulta}".
Tenés esta lista de lugares en formato JSON:
${JSON.stringify(payload)}

TAREA:
1. Analiza las descripciones de cada lugar e identifica cuáles necesitan cosas relacionadas con "${consulta}". Usa asociación semántica (ej. si busca "medicamentos", busca términos como "gasas", "pastillas", "paracetamol", "antibióticos").
2. Devuelve un objeto JSON estrictamente con este formato:
{
  "coincidencias": [
    { "reporteId": "id-del-reporte", "items": ["item1 encontrado", "item2 encontrado"] }
  ],
  "recomendaciones": ["sugerencia1", "sugerencia2"]
}
No agregues explicaciones, markdown o texto fuera del objeto JSON.`

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0, 
          maxOutputTokens: 1000,
          responseMimeType: "application/json" 
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Error de Gemini API:', errText)
      return NextResponse.json({ error: 'Error al conectar con la IA' }, { status: 500 })
    }

    const data = await res.json()
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    try {
      const resultado = JSON.parse(texto.trim())
      return NextResponse.json(resultado)
    } catch (parseError) {
      console.error('Error parseando JSON de Gemini:', texto, parseError)
      return NextResponse.json({ error: 'La IA devolvió un formato inválido' }, { status: 500 })
    }

  } catch (err) {
    console.error('Error crítico en el endpoint buscar-donacion:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
