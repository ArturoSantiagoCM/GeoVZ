'use client'
import { useState } from 'react'
import { MapPin, Calendar, ChevronDown, ChevronUp, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Reporte, CategoriaInfraestructura } from '@/types'
import { supabase } from '@/lib/supabase'

/* ── Paleta por categoría ─────────────────────────────────────── */
const CONFIG_INFRA: Record<string, { color: string; bg: string; border: string; emoji: string; label: string }> = {
  'Refugio':             { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', emoji: '🏠', label: 'Refugio' },
  'Centro Médico':       { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', emoji: '🏥', label: 'Centro Médico' },
  'Estructura_caida':    { color: '#57534e', bg: '#fafaf9', border: '#d6d3d1', emoji: '🧱', label: 'Estructura Caída' },
  'Peligro Estructural': { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', emoji: '⚠️', label: 'Peligro Estructural' },
  'Centro Veterinario':  { color: '#059669', bg: '#f0fdf4', border: '#a7f3d0', emoji: '🐾', label: 'Centro Veterinario' },
}

const DEFAULT_CONFIG = { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', emoji: '📍', label: 'Lugar' }

interface TarjetaReporteProps {
  reporte: Reporte
  onSelect: (reporte: Reporte) => void
  estaSeleccionado: boolean
  onUpdate?: (id: string, descripcion: string) => void  // callback para actualizar estado padre
}

export default function TarjetaReporte({ reporte, onSelect, estaSeleccionado, onUpdate }: TarjetaReporteProps) {
  const cfg = CONFIG_INFRA[reporte.categoria_infraestructura] ?? DEFAULT_CONFIG

  const [expandido, setExpandido]     = useState(false)
  const [editando, setEditando]       = useState(false)
  const [textoEdicion, setTextoEdicion] = useState(reporte.descripcion || '')
  const [guardando, setGuardando]     = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  const formatearFecha = (f: string) => {
    try {
      return new Date(f).toLocaleDateString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    } catch { return f }
  }

  const guardarDescripcion = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGuardando(true); setErrorGuardar(null)
    try {
      const { error } = await supabase
        .from('reportes').update({ descripcion: textoEdicion }).eq('id', reporte.id)
      if (error) throw error
      reporte.descripcion = textoEdicion
      setEditando(false)
      // Notificar al padre para que actualice su estado (y el popup del mapa)
      onUpdate?.(reporte.id, textoEdicion)
    } catch (err: unknown) {
      setErrorGuardar(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const cancelarEdicion = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTextoEdicion(reporte.descripcion || '')
    setEditando(false); setErrorGuardar(null)
  }

  const toggleExpandir = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandido(prev => !prev)
  }

  const iniciarEdicion = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandido(true); setEditando(true)
  }

  return (
    <div
      onClick={() => onSelect(reporte)}
      style={{
        borderColor: estaSeleccionado ? cfg.color : undefined,
        boxShadow: estaSeleccionado ? `0 0 0 2px ${cfg.color}22` : undefined,
      }}
      className={`
        group relative rounded-2xl border cursor-pointer transition-all duration-200 select-none overflow-hidden
        ${estaSeleccionado ? 'shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}
      `}
    >
      {/* Barra de color lateral */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ backgroundColor: cfg.color }}
      />

      <div className="ml-1.5 px-3 py-3 space-y-2">

        {/* ── Header: badge + fecha ── */}
        <div className="flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            <span>{cfg.emoji}</span>
            <span>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
            <Calendar size={10} />
            <span>{formatearFecha(reporte.creado_en)}</span>
          </div>
        </div>

        {/* ── Ubicación ── */}
        <div className="space-y-0.5 px-0.5">
          {(reporte.estado || reporte.municipio) && (
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <MapPin size={11} className="shrink-0" style={{ color: cfg.color }} />
              {[reporte.estado, reporte.municipio].filter(Boolean).join(' — ')}
            </p>
          )}
          {reporte.direccion_texto && (
            <p className="text-[11px] text-slate-500 leading-tight line-clamp-2 pl-4">
              {reporte.direccion_texto}
            </p>
          )}
          {!reporte.estado && !reporte.municipio && !reporte.direccion_texto && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 pl-0.5">
              <MapPin size={11} />
              <span>{Number(reporte.latitud).toFixed(4)}, {Number(reporte.longitud).toFixed(4)}</span>
            </div>
          )}
        </div>

        {/* ── Link Google Maps ── */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${Number(reporte.latitud)},${Number(reporte.longitud)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg
                     text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200
                     transition w-fit"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Ver en Google Maps
        </a>

        {/* ── Botón expandir ── */}
        <button
          onClick={toggleExpandir}
          className="w-full flex items-center justify-center gap-1 text-[19px] font-semibold text-slate-400 hover:text-blue-600 transition-colors py-1 rounded-lg hover:bg-blue-50"
        >
          {expandido
            ? <><ChevronUp size={12} /> Ocultar </>
            : <><ChevronDown size={12} /> Qué se Necesita?</>
          }
        </button>

        {/* ── Panel expandido ── */}
        {expandido && (
          <div
            className="rounded-xl border p-3 space-y-2"
            style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
            onClick={e => e.stopPropagation()}
          >
            {editando ? (
              <>
                <textarea
                  value={textoEdicion}
                  onChange={e => setTextoEdicion(e.target.value)}
                  rows={5}
                  className="w-full text-xs text-slate-700 bg-white border border-blue-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none leading-relaxed"
                  placeholder="Lista de necesidades..."
                />
                {errorGuardar && (
                  <p className="text-[10px] text-red-500 font-medium">{errorGuardar}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={cancelarEdicion}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold border border-slate-200 hover:bg-white text-slate-600 py-1.5 rounded-lg transition"
                  >
                    <X size={11} /> Cancelar
                  </button>
                  <button
                    onClick={guardarDescripcion}
                    disabled={guardando}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-bold text-white py-1.5 rounded-lg transition disabled:opacity-60"
                    style={{ backgroundColor: cfg.color }}
                  >
                    {guardando ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line min-h-[36px]">
                  {reporte.descripcion
                    ? reporte.descripcion
                    : <span className="text-slate-400 italic">Sin descripción aún.</span>
                  }
                </div>
                <button
                  onClick={iniciarEdicion}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 transition py-1 px-2 rounded-lg hover:bg-white"
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
