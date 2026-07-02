// components/BuscadorIA.tsx
'use client'
import { useState } from 'react'
import { Sparkles, Search, Loader2, MapPin, Lightbulb } from 'lucide-react'
import { Reporte } from '@/types'

interface BuscadorIAProps {
  reportes: Reporte[]
  onSeleccionarLugar?: (lat: number, lng: number, reporteId: string) => void
}

export default function BuscadorIA({ reportes, onSeleccionarLugar }: BuscadorIAProps) {
  const [consulta, setConsulta] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Guardaremos los objetos Reporte completos que la IA filtró
  const [lugaresFiltrados, setLugaresFiltrados] = useState<Reporte[]>([])
  const [recomendaciones, setRecomendaciones] = useState<string[]>([])

  const handleBuscar = async () => {
    const q = consulta.trim()
    if (!q || cargando) return

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
  // 👈 Aquí corregido: 'deVerdadCoinciden' todo junto sin espacios
  const deVerdadCoinciden = reportes.filter(r => datos.idsCoincidentes.includes(r.id))
  
  setLugaresFiltrados(deVerdadCoinciden) // 👈 Aquí también todo junto
  setRecomendaciones(datos.recomendaciones || [])

        if (de VerdadCoinciden.length === 0) {
          setError('No se encontraron puntos con necesidades relacionadas a tu búsqueda.')
        }
      } else {
        throw new Error('Estructura de datos inesperada.')
      }

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Error de conexión.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className=\"bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4\">
      <div className=\"flex items-center gap-2 text-violet-700 font-bold text-sm\">
        <Sparkles size={18} className=\"animate-pulse\" />
        <h2>Buscador Inteligente GeoVZ</h2>
      </div>

      {/* Input de búsqueda */}
      <div className=\"flex gap-2\">
        <div className=\"relative flex-1\">
          <input
            type=\"text\"
            placeholder=\"Ej: Medicinas para niños, herramientas, agua...\"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            className=\"w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-violet-500\"
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          />
          <Search size={14} className=\"absolute left-3 top-3.5 text-slate-400\" />
        </div>
        <button
          onClick={handleBuscar}
          disabled={cargando}
          className=\"bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 disabled:opacity-50\"
        >
          {cargando ? <Loader2 size={14} className=\"animate-spin\" /> : 'Buscar'}
        </button>
      </div>

      {error && <p className=\"text-xs text-red-500 bg-red-50 p-2 rounded-lg\">{error}</p>}

      {/* Lista de lugares encontrados */}
      {lugaresFiltrados.length > 0 && (
        <div className=\"space-y-3\">
          <h3 className=\"text-[11px] font-bold text-slate-500 uppercase tracking-wider\">
            Lugares que necesitan esto:
          </h3>
          <div className=\"max-h-60 overflow-y-auto space-y-2 pr-1\">
            {lugaresFiltrados.map((lugar) => (
              <div
                key={lugar.id}
                onClick={() => onSeleccionarLugar?.(lugar.latitud, lugar.longitud, lugar.id)}
                className=\"p-3 rounded-xl border border-slate-100 hover:border-violet-300 hover:bg-violet-50/50 cursor-pointer transition text-left space-y-1 group\"
              >
                <div className=\"flex items-center justify-between\">
                  <span className=\"text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 group-hover:bg-violet-100 group-hover:text-violet-700 transition\">
                    {lugar.tipo || 'Punto de ayuda'}
                  </span>
                  <span className=\"text-[10px] font-medium text-slate-400 flex items-center gap-0.5\">
                    <MapPin size={10} />
                    {lugar.municipio}, {lugar.estado}
                  </span>
                </div>
                <p className=\"text-xs font-semibold text-slate-800 line-clamp-2\">
                  {lugar.descripcion}
                </p>
                <p className=\"text-[10px] text-violet-600 font-bold pt-1 opacity-0 group-hover:opacity-100 transition-opacity\">
                  📍 Ver en el mapa →
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de sugerencias inteligentes */}
      {recomendaciones.length > 0 && (
        <div className=\"bg-amber-50/70 border border-amber-100 rounded-xl p-3 space-y-1.5\">
          <div className=\"flex items-center gap-1.5\">
            <Lightbulb size={14} className=\"text-amber-600\" />
            <p className=\"text-[10px] font-bold uppercase text-amber-800 tracking-wider\">
              También podrías considerar llevar:
            </p>
          </div>
          <div className=\"flex flex-wrap gap-1.5\">
            {recomendaciones.map((rec, i) => (
              <span key={i} className=\"text-[10px] font-semibold px-2 py-1 rounded-full bg-white border border-amber-200 text-amber-700\">
                {rec}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
