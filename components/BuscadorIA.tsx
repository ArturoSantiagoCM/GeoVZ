'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Search, Loader2, MapPin, Lightbulb, X, ChevronRight, ChevronDown, PackageSearch } from 'lucide-react'
import { Reporte } from '@/types'

interface BuscadorIAProps {
  reportes: Reporte[]
  onSeleccionarLugar?: (lat: number, lng: number, reporteId: string) => void
}

// Paleta de acentos para diferenciar tarjetas visualmente sin depender de datos extra
const ACENTOS = [
  { barra: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700' },
  { barra: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  { barra: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  { barra: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  { barra: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' },
]

export default function BuscadorIA({ reportes, onSeleccionarLugar }: BuscadorIAProps) {
  const [consulta, setConsulta] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guardamos los objetos Reporte filtrados por la IA
  const [lugaresFiltrados, setLugaresFiltrados] = useState<Reporte[]>([])
  const [recomendaciones, setRecomendaciones] = useState<string[]>([])

  // Indicador de scroll: sabemos si hay más tarjetas debajo
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hayMasAbajo, setHayMasAbajo] = useState(false)

  const revisarScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const quedaPorVer = el.scrollHeight - el.scrollTop - el.clientHeight
    setHayMasAbajo(quedaPorVer > 12)
  }, [])

  useEffect(() => {
    // Al llegar resultados nuevos, revisamos si el contenido ya desborda
    const id = requestAnimationFrame(revisarScroll)
    return () => cancelAnimationFrame(id)
  }, [lugaresFiltrados, revisarScroll])

  const handleBuscar = async () => {
    const q = consulta.trim()
    if (!q) {
      limpiarBusqueda()
      return
    }
    if (cargando) return

    if (!reportes || reportes.length === 0) {
      setError('No hay datos disponibles en el mapa para buscar.')
      return
    }

    setCargando(true)
    setError(null)
    setLugaresFiltrados([])
    setRecomendaciones([])

    try {
      const response = await fetch('/api/buscar-donacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consulta: q, reportes })
      })

      const datos = await response.json()

      if (!response.ok) throw new Error(datos.error || 'Error al buscar.')

      if (datos.idsCoincidentes && Array.isArray(datos.idsCoincidentes)) {
        // Cruzamos los IDs de la IA con nuestros reportes completos del frontend
        const deVerdadCoinciden = reportes.filter(r => datos.idsCoincidentes.includes(r.id))

        setLugaresFiltrados(deVerdadCoinciden)
        setRecomendaciones(datos.recomendaciones || [])

        if (deVerdadCoinciden.length === 0) {
          setError('No se encontraron puntos con necesidades relacionadas a tu búsqueda.')
        }
      } else {
        throw new Error('Estructura de datos inesperada desde el servidor.')
      }

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error de conexión.')
    } finally {
      setCargando(false)
    }
  }

  const limpiarBusqueda = () => {
    setConsulta('')
    setError(null)
    setLugaresFiltrados([])
    setRecomendaciones([])
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-violet-700 font-bold text-sm">
          <Sparkles size={18} className="animate-pulse" />
          <h2>Buscador Inteligente GeoVZ</h2>
        </div>
        {consulta && (
          <button
            onClick={limpiarBusqueda}
            className="text-slate-400 hover:text-slate-600 transition p-0.5 rounded-lg hover:bg-slate-100"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Input de búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Ej: Medicinas para niños, herramientas, agua..."
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-500"
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          />
          <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
        </div>
        <button
          onClick={handleBuscar}
          disabled={cargando}
          className="bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          {cargando ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}

      {/* Lista de lugares encontrados */}
      {lugaresFiltrados.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <PackageSearch size={13} className="text-violet-500" />
              Lugares que necesitan esto
            </h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-600 text-white">
              {lugaresFiltrados.length}
            </span>
          </div>

          {/* Contenedor con scroll visible + sombra/flecha que indica que hay más tarjetas */}
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={revisarScroll}
              className="ia-scroll max-h-72 overflow-y-auto space-y-2.5 pr-1.5 pb-1 scroll-smooth snap-y snap-proximity"
            >
              {lugaresFiltrados.map((lugar, idx) => {
                // Extraemos el tipo de manera segura para evitar errores de propiedades desconocidas en TypeScript
                const tipoUI = (lugar as any).tipo_necesidad || (lugar as any).tipo || lugar.categoria_infraestructura || 'Punto de ayuda'
                const acento = ACENTOS[idx % ACENTOS.length]

                return (
                  <button
                    key={lugar.id}
                    onClick={() => onSeleccionarLugar?.(Number(lugar.latitud), Number(lugar.longitud), lugar.id)}
                    className="w-full snap-start flex items-stretch gap-0 rounded-xl border border-slate-100 bg-white hover:border-violet-300 hover:bg-violet-50/50 active:scale-[0.98] active:bg-violet-50 cursor-pointer transition text-left overflow-hidden shadow-sm"
                  >
                    {/* Barra de acento lateral: ayuda a distinguir tarjetas de un vistazo */}
                    <span className={`w-1.5 shrink-0 ${acento.barra}`} />

                    <div className="flex-1 p-3 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md truncate max-w-[150px] ${acento.badge}`}>
                          {tipoUI}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 flex items-center gap-0.5 shrink-0">
                          <MapPin size={10} />
                          {lugar.municipio}, {lugar.estado}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                        {lugar.descripcion}
                      </p>
                      <p className="text-[10px] text-violet-600 font-bold pt-0.5 flex items-center gap-0.5">
                        Ver en el mapa <ChevronRight size={12} />
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Sombra + flecha inferior: solo aparece si hay más tarjetas para ver */}
            {hayMasAbajo && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-1.5 flex justify-center items-end pb-0.5 h-8 bg-gradient-to-t from-white via-white/90 to-transparent rounded-b-xl">
                <ChevronDown size={14} className="text-violet-400 animate-bounce mb-0.5" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sección de sugerencias inteligentes */}
      {recomendaciones.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb size={14} className="text-amber-600" />
            <p className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">
              También podrías considerar llevar:
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recomendaciones.map((rec, i) => (
              <span key={i} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white border border-amber-200 text-amber-700">
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scrollbar visible (fina, violeta) para que se note que hay contenido debajo */}
      <style jsx global>{`
        .ia-scroll {
          scrollbar-width: thin;
          scrollbar-color: #a78bfa #f1f5f9;
        }
        .ia-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .ia-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 999px;
        }
        .ia-scroll::-webkit-scrollbar-thumb {
          background-color: #a78bfa;
          border-radius: 999px;
        }
        .ia-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #8b5cf6;
        }
      `}</style>
    </div>
  )
}
