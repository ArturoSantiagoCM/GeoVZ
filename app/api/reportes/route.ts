import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET: obtener reportes
export async function GET() {
  const { data, error } = await supabase
    .from('reportes')
    .select('*')
    .eq('atendido', false)
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST: crear un reporte nuevo
export async function POST(request: NextRequest) {
  const body = await request.json()

  const { error } = await supabase
    .from('reportes')
    .insert({
      latitud: body.latitud,
      longitud: body.longitud,
      estado: body.estado,
      municipio: body.municipio,
      tipo: body.tipo,
      descripcion: body.descripcion,
      urgencia: body.urgencia ?? 2,
      contacto: body.contacto,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}