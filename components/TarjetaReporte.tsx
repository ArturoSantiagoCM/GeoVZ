'use client'
import { MapPin, Phone, Calendar, ChevronRight } from 'lucide-react'
import { Reporte } from '@/types'

// Colores correspondientes a cada tipo de necesidad
const coloresPorTipo: Record<string, string> = {
  'Agua': '#3b82f6',              // Azul
  'Comida': '#f97316',            // Naranja
  'Ropa': '#eab308',              // Amarillo
  'Medicamentos': '#a855f7',      // Púrpura
  'Equipo de Rescate': '#ef4444',  // Rojo
  'Equipo Médico': '#db2777',     // Rosa
  'Equipo Veterinario': '#10b981',// Verde
  'Maquinaria de Rescate': '#4b5563', // Gris
  'Objetos para Rescate': '#0d9488'  // Turquesa
}

interface TarjetaReporteProps {
  reporte: Reporte
  onSelect: (reporte: Reporte) => void
  estaSeleccionado: boolean
}

export default function TarjetaReporte({
  reporte,
  onSelect,
  estaSeleccionado
}: TarjetaReporteProps) {
  const color = coloresPorTipo[reporte.tipo_necesidad] || '#ef4444'

  // Formateador de fecha simple
  const formatearFecha = (fechaString: string) => {
    try {
      const fecha = new Date(fechaString)
      return fecha.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return fechaString
    }
  }

  return (
    <div
      onClick={() => onSelect(reporte)}
      className={`group relative p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 select-none ${
        estaSeleccionado
          ? 'bg-slate-50 border-blue-500 shadow-md ring-1 ring-blue-500/20'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5'
      }`}
    >
      {/* Indicador de color lateral */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl transition-all"
        style={{ backgroundColor: color }}
      />

      <div className="pl-2 space-y-2">
        {/* Encabezado: Necesidad e Infraestructura */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <h3
              className="text-sm font-bold tracking-tight uppercase"
              style={{ color }}
            >
              {reporte.tipo_necesidad}
            </h3>
            <span className="inline-block px-2 py-0.5 mt-1 bg-slate-100 rounded text-[10px] font-semibold text-slate-600 uppercase">
              {reporte.categoria_infraestructura.replace('_', ' ')}
            </span>
          </div>
          <ChevronRight
            size={16}
            className={`text-slate-300 group-hover:text-slate-500 transition-transform ${
              estaSeleccionado ? 'text-blue-500 translate-x-1' : ''
            }`}
          />
        </div>

        {/* Descripción */}
        {reporte.descripcion && (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
            "{reporte.descripcion}"
          </p>
        )}

        {/* Información de Ubicación */}
       <div className="space-y-1 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {reporte.estado ? `${reporte.estado}, ` : ''}
              {reporte.municipio ? `${reporte.municipio}` : ''}
            </span>
          </div>
          {reporte.direccion_texto && (
            <div className="pl-4 text-[10px] text-slate-400 truncate">
              {reporte.direccion_texto}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {reporte.latitud ? `${reporte.latitud}, ` : ''}
              {reporte.longitud ? `${reporte.longitud}` : ''}
            </span>
          </div>
        </div>

        {/* Info inferior: Contacto y Fecha */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
          {reporte.contacto ? (
            <div className="flex items-center gap-1 text-slate-500">
              <Phone size={10} className="text-slate-400 shrink-0" />
              <span className="font-medium truncate max-w-[120px]">{reporte.contacto}</span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-slate-400 shrink-0" />
            <span>{formatearFecha(reporte.creado_en)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
