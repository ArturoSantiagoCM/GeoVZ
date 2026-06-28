'use client'
import { useState } from 'react'
import { MapPin, Calendar, ChevronDown, ChevronUp, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Reporte, CategoriaInfraestructura } from '@/types'
import { supabase } from '@/lib/supabase'

const coloresPorInfraestructura: Record<string, string> = {
  'Refugio':             '#3b82f6',
  'Centro Médico':       '#ef4444',
  'Estructura_caida':    '#78716c',
  'Peligro Estructural': '#f97316',
  'Centro Veterinario':  '#10b981',
}

const emojiPorInfraestructura: Record<string, string> = {
  'Refugio':             '🏠',
  'Centro Médico':       '🏥',
  'Estructura_caida':    '🧱',
  'Peligro Estructural': '⚠️',
  'Centro Veterinario':  '🐾',
}

interface TarjetaReporteProps {
  reporte: Reporte
  onSelect: (reporte: Reporte) => void
  estaSeleccionado: boolean
}

export default function TarjetaReporte({ reporte, onSelect, estaSeleccionado }: TarjetaReporteProps) {
  const color = coloresPorInfraestructura[reporte.categoria_infraestructura] || '#64748b'
  const emoji = emojiPorInfraestructura[reporte.categoria_infraestructura] || '📍'

  const [expandido, setExpandido] = useState(false)
  const [editando, setEditando] = useState(false)
  const [textoEdicion, setTextoEdicion] = useState(reporte.descripcion || '')
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const formatearFecha = (fechaString: string) => {
    try {
      return new Date(fechaString).toLocaleDateString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      })
    } catch { return fechaString }
  }

  const guardarDescripcion = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const { error } = await supabase
        .from('reportes')
        .update({ descripcion: textoEdicion })
        .eq('id', reporte.id)
      if (error) throw error
      reporte.descripcion = textoEdicion
      setEditando(false)
    } catch (err: unknown) {
      setErrorGuardar(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const cancelarEdicion = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTextoEdicion(reporte.descripcion || '')
    setEditando(false)
    setErrorGuardar(null)
  }

  const toggleExpandir = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandido(prev => !prev)
  }

  const iniciarEdicion = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandido(true)
    setEditando(true)
  }

  return (
    <div
      onClick={() => onSelect(reporte)}
      className={`group relative rounded-xl border cursor-pointer transition-all duration-200 select-none overflow-hidden ${
        estaSeleccionado
          ? 'border-blue-400 shadow-md ring-1 ring-blue-400/20'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Barra de color lateral */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: color }} />

      <div className="pl-3 pr-4 py-3.5 space-y-2.5">
        {/* ── Badge tipo de local ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{emoji}</span>
            <span
              className="text-sm font-black tracking-tight uppercase"
              style={{ color }}
            >
              {reporte.categoria_infraestructura.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Calendar size={10} className="shrink-0" />
            <span>{formatearFecha(reporte.creado_en)}</span>
          </div>
        </div>

        {/* ── Separador ── */}
        <div className="h-px bg-slate-100" />

        {/* ── Dirección centrada ── */}
        <div className="text-center space-y-0.5 px-2">
          {(reporte.estado || reporte.municipio) && (
            <p className="text-xs font-bold text-slate-700">
              {[reporte.estado, reporte.municipio].filter(Boolean).join(' — ')}
            </p>
          )}
          {reporte.direccion_texto && (
            <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">
              {reporte.direccion_texto}
            </p>
          )}
          {!reporte.estado && !reporte.municipio && !reporte.direccion_texto && (
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <MapPin size={11} />
              <span>{Number(reporte.latitud).toFixed(4)}, {Number(reporte.longitud).toFixed(4)}</span>
            </div>
          )}
        </div>

        {/* ── Botón expandir ── */}
        <button
          onClick={toggleExpandir}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-blue-600 transition py-0.5 rounded-lg hover:bg-blue-50"
        >
          {expandido ? (
            <><ChevronUp size={12} /> Ocultar necesidades</>
          ) : (
            <><ChevronDown size={12} /> Ver lista de necesidades</>
          )}
        </button>

        {/* ── Panel expandible ── */}
        {expandido && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2" onClick={e => e.stopPropagation()}>
            {editando ? (
              <>
                <textarea
                  value={textoEdicion}
                  onChange={e => setTextoEdicion(e.target.value)}
                  rows={5}
                  className="w-full text-xs text-slate-700 bg-white border border-blue-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none leading-relaxed"
                  placeholder="Lista de necesidades del lugar..."
                />
                {errorGuardar && <p className="text-[10px] text-red-500 font-medium">{errorGuardar}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={cancelarEdicion}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold border border-slate-200 hover:bg-slate-100 text-slate-600 py-1.5 rounded-lg transition"
                  >
                    <X size={11} /> Cancelar
                  </button>
                  <button
                    onClick={guardarDescripcion}
                    disabled={guardando}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-1.5 rounded-lg transition"
                  >
                    {guardando ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line min-h-[40px]">
                  {reporte.descripcion
                    ? reporte.descripcion
                    : <span className="text-slate-400 italic">Sin descripción de necesidades.</span>
                  }
                </div>
                <button
                  onClick={iniciarEdicion}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition py-1 px-2 rounded-lg hover:bg-blue-50"
                >
                  <Pencil size={10} /> Editar lista
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
