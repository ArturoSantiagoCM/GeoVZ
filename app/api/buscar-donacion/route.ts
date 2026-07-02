// app/api/buscar-donacion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Reporte } from '@/types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL    = 'llama-3.1-8b-instant'

/* ── Normaliza texto: minúsculas, sin tildes, sin espacios extra ── */
function normalizar(t: string): string {
  return t.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim()
}

/* ── Extrae ítems reales de una descripción ── */
function extraerItems(desc: string): string[] {
  return desc
    .split(/\n|,|;/)
    .map(l => l.replace(/^[-•*·\s]+/, '').trim())
    .filter(l => l.replace(/[.\-\s•*]/g, '').length > 3)
}

export async function POST(req: NextRequest) {
  try {
    const { consulta, reportes }: { consulta: string; reportes: Reporte[] } = await req.json()

    if (!consulta?.trim()) {
      return NextResponse.json({ error: 'Consulta vacía' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 500 })
    }

    /* ── 1. Extraer ítems por reporte (solo los que tienen descripción real) ── */
    const reportesConItems = reportes
      .filter(r => (r.descripcion ?? '').replace(/[.\-\s•*]/g, '').length > 3)
      .map(r => ({ id: r.id, items: extraerItems(r.descripcion!) }))
      .filter(r => r.items.length > 0)

    if (reportesConItems.length === 0) {
      return NextResponse.json({ coincidencias: [] })
    }

    /* ── 2. Deduplicar ítems — clave para ahorrar tokens ── */
    const itemsUnicos = [...new Set(
      reportesConItems.flatMap(r => r.items.map(normalizar))
    )]

    /* ── 3. Prompt ultra-compacto: solo clasificar, sin inventar ── */
    const prompt = `Tarea: clasificar ítems de donaciones humanitarias.
Categoría buscada: "${consulta}"
Ítems a clasificar (uno por línea):
${itemsUnicos.join('\n')}

Respondé SOLO con un array JSON de los ítems que pertenecen a "${consulta}".
Si ninguno pertenece, respondé [].
Sin explicaciones, sin markdown, solo el JSON.`

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 300,  // clasificar ítems no necesita más
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Groq error:', err)
      return NextResponse.json({ error: 'Error de Groq' }, { status: 500 })
    }

    const data = await res.json()
    const texto = data.choices?.[0]?.message?.content ?? '[]'
    const limpio = texto.replace(/```json|```/g, '').trim()

    let itemsCoinciden: string[]
    try {
      itemsCoinciden = JSON.parse(limpio)
      if (!Array.isArray(itemsCoinciden)) itemsCoinciden = []
    } catch {
      itemsCoinciden = []
    }

    /* ── 4. Cruzar localmente: qué reportes tienen esos ítems ── */
    const itemsSet = new Set(itemsCoinciden.map(normalizar))

    const coincidencias = reportesConItems
      .map(r => ({
        reporteId: r.id,
        items: r.items.filter(item => itemsSet.has(normalizar(item))),
      }))
      .filter(r => r.items.length > 0)

    return NextResponse.json({ coincidencias })

  } catch (err) {
    console.error('Error en buscar-donacion:', err)
    return NextResponse.json({ error: 'Error al procesar la búsqueda' }, { status: 500 })
  }
}
