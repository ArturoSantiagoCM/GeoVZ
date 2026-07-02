// app/api/buscar-donacion/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Definimos una interfaz limpia para los elementos mapeados
interface ItemReporte {
  id: string
  tipo: string
  descripcion: string
}

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
      console.error('Error de configuración: Falta GEMINI_API_KEY en las variables de entorno.')
      return NextResponse.json({ error: 'Falta la configuración de la API Key.' }, { status: 500 })
    }

    // Mapeamos los datos de Supabase y forzamos el tipado explícito en el filtro
    // Truncamos la descripción y limitamos la cantidad de reportes que le mandamos
    // a la IA: mientras más crece la base de datos, más grande es el JSON de salida
    // que Gemini tiene que generar, y si se pasa de maxOutputTokens la respuesta
    // se corta a la mitad y JSON.parse falla ("Formato de respuesta inválido").
    const MAX_REPORTES_PARA_IA = 200
    const MAX_LARGO_DESCRIPCION = 300

    const datosParaIA = reportes
      .map((r: any) => ({
        id: (r.id || '').toString(),
        tipo: (r.tipo || r.categoria_infraestructura || 'Punto de acopio').toString(),
        descripcion: (r.descripcion || '').trim().slice(0, MAX_LARGO_DESCRIPCION)
      }))
      .filter((item: ItemReporte) => item.descripcion.length > 0)
      .slice(0, MAX_REPORTES_PARA_IA)

    const prompt = `Actúas como un filtro inteligente para un mapa de ayuda humanitaria en Venezuela.
Analiza las descripciones de los lugares y determina cuáles necesitan insumos relacionados con la búsqueda: "${consulta}".

Usa criterio semántico amplio (ej. si busca "medicamentos", incluye lugares que pidan "pastillas", "paracetamol", "antibióticos", "gasas", "suero").

DATOS DE LOS LUGARES (JSON):
${JSON.stringify(datosParaIA)}

TAREA:
1. Devuelve SOLO los "id" de los lugares cuya descripción coincida con la búsqueda.
2. Genera una lista de hasta 3 artículos complementarios generales que se sugiera donar basados en la necesidad global de los datos provistos.

DEBES RESPONDER EXCLUSIVAMENTE ESTE FORMATO JSON (sin markdown, sin bloques de código):
{
  "idsCoincidentes": ["id1", "id2"],
  "recomendaciones": ["artículo1", "artículo2"]
}`

    // gemini-2.0-flash fue apagado por Google el 1 de junio de 2026.
    // Migramos a gemini-2.5-flash-lite (mismo precio que 2.0-flash, estable).
    const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'
    
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          // Subimos el límite: con muchos reportes coincidiendo, la lista de
          // "idsCoincidentes" puede ser larga y 800 tokens se quedaba corto,
          // truncando el JSON a la mitad.
          maxOutputTokens: 3000,
          responseMimeType: "application/json",
          // Los modelos 2.5 tienen "thinking" activado por defecto, lo que
          // consume tokens extra y puede provocar respuestas vacías si
          // maxOutputTokens es bajo. Lo desactivamos porque esta tarea
          // (filtrar/clasificar) no lo necesita.
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    })

    if (!res.ok) {
      const errTxt = await res.text()
      console.error('Error de Gemini API:', res.status, errTxt)

      if (res.status === 429) {
        return NextResponse.json(
          { error: 'Se alcanzó el límite de solicitudes a la IA (rate limit). Intenta de nuevo en un momento.', detalle: errTxt },
          { status: 502 }
        )
      }

      // Devolvemos el detalle en dev/preview para poder depurar rápido.
      return NextResponse.json(
        { error: 'La IA no pudo procesar la solicitud.', detalle: errTxt },
        { status: 502 }
      )
    }

    const data = await res.json()
    const candidato = data.candidates?.[0]
    const textoJson = candidato?.content?.parts?.[0]?.text ?? ''
    const finishReason = candidato?.finishReason

    // Si Google bloqueó la respuesta por seguridad, no hay texto que parsear.
    if (data.promptFeedback?.blockReason) {
      console.error('Gemini bloqueó el prompt:', data.promptFeedback)
      return NextResponse.json(
        { error: 'La IA bloqueó la solicitud por políticas de seguridad.', detalle: data.promptFeedback },
        { status: 500 }
      )
    }

    // Si se cortó por límite de tokens, el JSON queda a la mitad: lo detectamos
    // antes de intentar parsear para dar un mensaje claro en vez de uno genérico.
    if (finishReason === 'MAX_TOKENS') {
      console.error('Respuesta de Gemini truncada por MAX_TOKENS. Largo del texto:', textoJson.length)
      return NextResponse.json(
        { error: 'La respuesta de la IA se cortó por ser demasiado larga. Intenta con una búsqueda más específica.' },
        { status: 500 }
      )
    }

    try {
      const resultadoEstable = JSON.parse(textoJson.trim())
      return NextResponse.json(resultadoEstable)
    } catch (err) {
      console.error('Error parseando JSON de Gemini. finishReason:', finishReason, 'texto:', textoJson)
      return NextResponse.json(
        { error: 'Formato de respuesta inválido.', detalle: { finishReason, textoRecibido: textoJson.slice(0, 500) } },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error crítico en el servidor:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
