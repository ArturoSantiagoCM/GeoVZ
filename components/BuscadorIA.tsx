'use client'
import { useState, useRef } from 'react'
import { Sparkles, Search, Loader2, X, MapPin, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'
import { Reporte } from '@/types'

/* ─── Tipos ─────────────────────────────────────────────────── */
interface ResultadoLugar {
  reporteId: string
  tipo: string
  ubicacion: string
  itemsCoinciden: string[]   // ítems que SÍ coinciden con la búsqueda
}

interface RespuestaGemini {
  coincidencias: {
    reporteId: string
    items: string[]          // solo los ítems realmente relacionados
  }[]
  recomendaciones: string[]  // qué más llevar (basado en lo que existe en datos)
}

/* ─── Paleta ─────────────────────────────────────────────────── */
const CFG: Record<string, { color: string; bg: string; border: string; emoji: string; label: string }> = {
  'Refugio':             { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', emoji: '🏠', label: 'Refugio' },
  'Centro Médico':       { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '🏥', label: 'Centro Médico' },
  'Estructura_caida':    { color: '#57534e', bg: '#fafaf9', border: '#d6d3d1', emoji: '🧱', label: 'Estructura Caída' },
  'Peligro Estructural': { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', emoji: '⚠️', label: 'Peligro Estructural' },
  'Centro Veterinario':  { color: '#059669', bg: '#f0fdf4', border: '#a7f3d0', emoji: '🐾', label: 'Centro Veterinario' },
}
const D = { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', emoji: '📍', label: 'Lugar' }

/* ─── Utilidades ─────────────────────────────────────────────── */

/** Extrae ítems reales de una descripción (filtra líneas vacías / puntitos) */
function extraerItems(desc: string): string[] {
  return desc
    .split(/\n|,|;/)
    .map(l => l.replace(/^[-•*·\s]+/, '').trim())
    .filter(l => l.replace(/[.\s]/g, '').length > 3)  // mínimo 3 caracteres significativos
}

/** Construye el payload compacto que se manda a Gemini */
function buildPayload(reportes: Reporte[]): { id: string; items: string[] }[] {
  return reportes
    .filter(r => {
      const texto = (r.descripcion ?? '').trim()
      // Descarta descripciones vacías o con solo signos/espacios
      return texto.replace(/[.\-\s•*]/g, '').length > 3
    })
    .map(r => ({
      id: r.id,
      items: extraerItems(r.descripcion!),
    }))
    .filter(r => r.items.length > 0)
}

/** Construye la ubicación legible de un reporte */
function ubicacion(r: Reporte): string {
  return [r.estado, r.municipio].filter(Boolean).join(', ')
    || r.direccion_texto
    || `${Number(r.latitud).toFixed(4)}, ${Number(r.longitud).toFixed(4)}`
}

/* ─── Componente ─────────────────────────────────────────────── */
interface Props { reportes: Reporte[] }

export default function BuscadorIA({ reportes }: Props) {
  const [abierto, setAbierto]       = useState(false)
  const [consulta, setConsulta]     = useState('')
  const [cargando, setCargando]     = useState(false)
  const [resultado, setResultado]   = useState<ResultadoLugar[] | null>(null)
  const [recomendaciones, setRecomendaciones] = useState<string[]>([])
  const [error, setError]           = useState<string | null>(null)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const inputRef                    = useRef<HTMLInputElement>(null)

  const toggle = (id: string) => setExpandidos(p => ({ ...p, [id]: !p[id] }))

  const limpiar = () => {
    setConsulta(''); setResultado(null)
    setRecomendaciones([]); setError(null); setExpandidos({})
    inputRef.current?.focus()
  }

  const buscar = async () => {
    const q = consulta.trim()
    if (!q || cargando) return

    const payload = buildPayload(reportes)

    if (payload.length === 0) {
      setError('No hay lugares con necesidades registradas aún.')
      return
    }

    setCargando(true); setError(null); setResultado(null); setRecomendaciones([])

    /* ── Prompt ultra-compacto ── */
    const prompt = `Sos un asistente de ayuda humanitaria. El usuario quiere donar: "${q}".

Tenés esta lista de lugares con sus ítems de necesidad:
${JSON.stringify(payload)}

TAREA:
1. Para cada lugar, indicá cuáles ítems de su lista están relacionados con "${q}". Si ningún ítem está relacionado, no incluyas ese lugar.
2. Basándote SOLO en los ítems que aparecen en los datos (no inventes nada), sugerí hasta 3 artículos adicionales que el donante podría llevar que complementen su donación de "${q}" y que aparezcan en algún lugar de los datos.

REGLAS CRÍTICAS:
- Solo incluí ítems que existan EXACTAMENTE en los datos proporcionados.
- No inferás, no inventes, no agregues nada que no esté escrito en los datos.
- Si ningún lugar tiene ítems relacionados con "${q}", devolvé coincidencias: [].
- Las recomendaciones deben ser ítems que realmente aparezcan en algún lugar de los datos.

Respondé SOLO con este JSON (sin markdown, sin texto extra):
{
  "coincidencias": [
    { "reporteId": "id-del-lugar", "items": ["ítem relacionado 1", "ítem relacionado 2"] }
  ],
  "recomendaciones": ["ítem complementario 1", "ítem complementario 2"]
}`

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 800 },
          }),
        }
      )

      const data = await res.json()
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const limpio = texto.replace(/```json|```/g, '').trim()
      const parsed: RespuestaGemini = JSON.parse(limpio)

      // Cruzar IDs de Gemini con los reportes en memoria
      const mapaReportes = Object.fromEntries(reportes.map(r => [r.id, r]))
      const resultados: ResultadoLugar[] = parsed.coincidencias
        .filter(c => c.items.length > 0 && mapaReportes[c.reporteId])
        .map(c => {
          const r = mapaReportes[c.reporteId]
          return {
            reporteId: c.reporteId,
            tipo: r.categoria_infraestructura,
            ubicacion: ubicacion(r),
            itemsCoinciden: c.items,
          }
        })

      setResultado(resultados)
      setRecomendaciones(parsed.recomendaciones ?? [])
    } catch {
      setError('No se pudo procesar la búsqueda. Verificá tu conexión e intentá de nuevo.')
    } finally {
      setCargando(false) }
  }

  return (
    <div className="mx-4 mt-4 mb-1">

      {/* ── Botón cabecera ── */}
      <button
        onClick={() => { setAbierto(p => !p); setTimeout(() => inputRef.current?.focus(), 100) }}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl
                   bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md
                   hover:from-violet-700 hover:to-blue-700 transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} className="shrink-0" />
          <div className="text-left">
            <p className="text-sm font-black leading-tight">Buscar con IA</p>
            <p className="text-[10px] text-white/70 font-medium">¿Qué querés donar?</p>
          </div>
        </div>
        {abierto ? <ChevronUp size={16} className="text-white/80" /> : <ChevronDown size={16} className="text-white/80" />}
      </button>

      {/* ── Panel ── */}
      {abierto && (
        <div className="mt-2 rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">

          {/* Input */}
          <div className="px-4 pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={consulta}
                  onChange={e => setConsulta(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscar()}
                  placeholder="Ej: mantas, medicamentos, agua…"
                  className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl
                             focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400
                             text-slate-700 placeholder:text-slate-400 transition"
                />
                {consulta && (
                  <button onClick={limpiar} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={buscar}
                disabled={!consulta.trim() || cargando}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white
                           bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300
                           transition disabled:cursor-not-allowed shrink-0"
              >
                {cargando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {cargando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>

            {/* Chips ejemplo */}
            {!resultado && !cargando && (
              <div className="flex flex-wrap gap-1.5">
                {['mantas', 'medicamentos', 'agua', 'ropa', 'alimentos'].map(ej => (
                  <button
                    key={ej}
                    onClick={() => { setConsulta(ej); setTimeout(buscar, 50) }}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full
                               border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition"
                  >
                    {ej}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cargando */}
          {cargando && (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin text-violet-600" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Analizando necesidades registradas…</p>
            </div>
          )}

          {/* Error */}
          {error && !cargando && (
            <div className="mx-4 mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          {/* Resultados */}
          {resultado && !cargando && (
            <div className="px-4 pb-4 space-y-3">

              {/* Sin resultados */}
              {resultado.length === 0 ? (
                <div className="text-center py-8 space-y-1">
                  <p className="text-3xl">🔍</p>
                  <p className="text-sm font-bold text-slate-600">No hay lugares que necesiten eso</p>
                  <p className="text-xs text-slate-400">Ningún lugar registrado indicó necesitar "{consulta}"</p>
                  <button onClick={limpiar} className="mt-3 text-[11px] font-bold text-violet-600 hover:underline">
                    Intentar con otra donación
                  </button>
                </div>
              ) : (
                <>
                  {/* Resumen */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100">
                    <Sparkles size={13} className="text-violet-500 shrink-0" />
                    <p className="text-xs text-violet-800 font-semibold">
                      {resultado.length} {resultado.length === 1 ? 'lugar necesita' : 'lugares necesitan'} {consulta}
                    </p>
                  </div>

                  {/* Tarjetas de lugares */}
                  {resultado.map((lugar) => {
                    const cfg = CFG[lugar.tipo] ?? D
                    const expandido = expandidos[lugar.reporteId] ?? true
                    return (
                      <div key={lugar.reporteId} className="rounded-xl border overflow-hidden" style={{ borderColor: cfg.border }}>
                        <button
                          onClick={() => toggle(lugar.reporteId)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                          style={{ backgroundColor: cfg.bg }}
                        >
                          <span className="text-lg shrink-0">{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate" style={{ color: cfg.color }}>{cfg.label}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin size={9} style={{ color: cfg.color }} className="shrink-0" />
                              <p className="text-[10px] text-slate-500 truncate">{lugar.ubicacion}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.border, color: cfg.color }}>
                            {lugar.itemsCoinciden.length} {lugar.itemsCoinciden.length === 1 ? 'ítem' : 'ítems'}
                          </span>
                          {expandido
                            ? <ChevronUp size={13} style={{ color: cfg.color }} className="shrink-0" />
                            : <ChevronDown size={13} style={{ color: cfg.color }} className="shrink-0" />
                          }
                        </button>

                        {expandido && (
                          <div className="px-3 py-2.5 bg-white border-t space-y-1.5" style={{ borderColor: cfg.border }}>
                            {lugar.itemsCoinciden.map((item, j) => (
                              <div key={j} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: cfg.color }} />
                                <p className="text-xs text-slate-700 leading-snug">{item}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Recomendaciones */}
                  {recomendaciones.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb size={12} className="text-amber-500 shrink-0" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                          También podrías llevar
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recomendaciones.map((rec, i) => (
                          <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full
                                                    bg-white border border-amber-200 text-amber-700">
                            {rec}
                          </span>
                        ))}
                      </div>
                      <p className="text-[9px] text-amber-500 font-medium">
                        Basado en lo que otros lugares registrados también necesitan
                      </p>
                    </div>
                  )}

                  {/* Nueva búsqueda */}
                  <button
                    onClick={limpiar}
                    className="w-full text-[11px] font-bold text-violet-600 hover:text-violet-800
                               py-2 rounded-xl border border-violet-200 hover:bg-violet-50 transition"
                  >
                    Nueva búsqueda
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
