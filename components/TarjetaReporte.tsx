'use client'
import { useRef, useState } from 'react'
import { MapPin, Calendar, Map, Loader2, Check } from 'lucide-react'
import { Reporte } from '@/types'
import { supabase } from '@/lib/supabase'

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
}

export default function TarjetaReporte({ reporte, onSelect, estaSeleccionado }: TarjetaReporteProps) {
  const cfg = CONFIG_INFRA[reporte.categoria_infraestructura] ?? DEFAULT_CONFIG

  const [texto, setTexto]         = useState(reporte.descripcion || '')
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado]   = useState(false)
  const [error, setError]         = useState('')

  const formatearFecha = (f: string) => {
    try {
      return new Date(f).toLocaleDateString('es-VE', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    } catch { return f }
  }

  const guardar = async () => {
    setGuardando(true)
    setError('')
    setGuardado(false)
    const { error: err } = await supabase
      .from('reportes')
      .update({ descripcion: texto })
      .eq('id', reporte.id)
    if (err) {
      setError('Error al guardar. Intenta de nuevo.')
    } else {
      reporte.descripcion = texto
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    }
    setGuardando(false)
  }

  return (
    <div
      style={{
        borderColor: estaSeleccionado ? cfg.color : undefined,
        boxShadow: estaSeleccionado ? `0 0 0 2px ${cfg.color}22` : undefined,
      }}
      className={`
        group relative rounded-2xl border cursor-pointer transition-all duration-200 select-none overflow-hidden
        ${estaSeleccionado ? 'shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}
      `}
    >
      {/* Barra lateral de color */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ backgroundColor: cfg.color }} />

      <div className="ml-1.5 px-3 py-3 space-y-2">

        {/* Header */}
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

        {/* Ubicación */}
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

        {/* Descripción + botão OK */}
        <div
          className="rounded-xl border p-3 space-y-2"
          style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Necesidades</p>
            {guardando && <Loader2 size={10} className="text-slate-400 animate-spin" />}
            {!guardando && guardado && <span className="text-[9px] text-green-500 font-bold">✓ Guardado</span>}
            {!guardando && error && <span className="text-[9px] text-red-500 font-bold">{error}</span>}
          </div>

          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={4}
            className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400
                       resize-none leading-relaxed transition"
            placeholder="Lista de necesidades..."
          />

          {/* Botão OK — só aparece se o texto mudou */}
          {texto !== (reporte.descripcion || '') && !guardando && (
            <button
              onClick={guardar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold
                         text-white transition active:scale-95"
              style={{ backgroundColor: cfg.color }}
            >
              <Check size={11} />
              OK — Guardar
            </button>
          )}
        </div>

        {/* Botão Ver en mapa */}
        <button
          onClick={() => onSelect(reporte)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-xl transition"
          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
        >
          <Map size={12} />
          Ver en mapa
        </button>

      </div>
    </div>
  )
}
