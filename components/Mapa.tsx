'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { Reporte } from '@/types'
import L from 'leaflet'

// ─── Colores por Infraestructura ──────────────────────────────────────────────
const coloresPorInfraestructura: Record<string, string> = {
  'Refugio':             '#3b82f6', // Azul
  'Centro Médico':       '#ef4444', // Rojo
  'Estructura_caida':    '#78716c', // Gris tierra
  'Peligro Estructural': '#f97316', // Naranja
  'Centro Veterinario':  '#10b981', // Verde
}

// ─── Iconos SVG por Categoría de Infraestructura ──────────────────────────────
const crearIconoInfraestructura = (categoria: string) => {
  const color = coloresPorInfraestructura[categoria] || '#64748b'

  const svgsPorCategoria: Record<string, string> = {
    'Refugio': `
      <!-- Casa -->
      <polygon points="15,2 28,13 28,30 2,30 2,13" fill="${color}" stroke="white" stroke-width="1.5"/>
      <rect x="10" y="18" width="10" height="12" fill="white" opacity="0.9"/>
      <polygon points="15,2 2,13 28,13" fill="${color}" stroke="white" stroke-width="1.5"/>
    `,
    'Centro Médico': `
      <!-- Cruz médica -->
      <rect x="2" y="2" width="26" height="26" rx="5" fill="${color}"/>
      <rect x="12" y="6" width="6" height="18" fill="white"/>
      <rect x="6" y="12" width="18" height="6" fill="white"/>
    `,
    'Estructura_caida': `
      <!-- Escombros -->
      <polygon points="4,28 12,8 20,22 26,12 28,28" fill="${color}" stroke="white" stroke-width="1.2"/>
      <line x1="2" y1="28" x2="28" y2="28" stroke="white" stroke-width="2"/>
      <line x1="8" y1="20" x2="14" y2="26" stroke="white" stroke-width="1.5"/>
      <line x1="18" y1="16" x2="24" y2="22" stroke="white" stroke-width="1.5"/>
    `,
    'Peligro Estructural': `
      <!-- Edificio con triángulo de alerta -->
      <rect x="4" y="10" width="22" height="20" rx="2" fill="${color}" stroke="white" stroke-width="1.2"/>
      <rect x="8" y="14" width="5" height="5" rx="1" fill="white" opacity="0.8"/>
      <rect x="17" y="14" width="5" height="5" rx="1" fill="white" opacity="0.8"/>
      <rect x="12" y="22" width="6" height="8" fill="white" opacity="0.9"/>
      <polygon points="15,0 28,10 2,10" fill="#f59e0b" stroke="white" stroke-width="1.2"/>
      <text x="15" y="9" text-anchor="middle" font-size="8" font-weight="bold" fill="white">!</text>
    `,
    'Centro Veterinario': `
      <!-- Pata de animal -->
      <ellipse cx="15" cy="17" rx="8" ry="9" fill="${color}"/>
      <ellipse cx="8" cy="8" rx="4" ry="5" fill="${color}"/>
      <ellipse cx="15" cy="5" rx="4" ry="5" fill="${color}"/>
      <ellipse cx="22" cy="8" rx="4" ry="5" fill="${color}"/>
      <ellipse cx="8" cy="8" rx="2.5" ry="3" fill="white" opacity="0.6"/>
      <ellipse cx="15" cy="5" rx="2.5" ry="3" fill="white" opacity="0.6"/>
      <ellipse cx="22" cy="8" rx="2.5" ry="3" fill="white" opacity="0.6"/>
    `,
  }

  const svgInterior = svgsPorCategoria[categoria] || `<circle cx="15" cy="15" r="12" fill="${color}"/>`

  const svgHtml = `
    <div style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4)); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      <svg width="36" height="36" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="14" fill="white" stroke="${color}" stroke-width="2"/>
        ${svgInterior}
      </svg>
    </div>
  `

  return L.divIcon({
    html: svgHtml,
    className: 'infra-marker-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  })
}

// ─── Icono temporal para nuevo reporte ────────────────────────────────────────
const crearIconoTemporal = () => {
  const svgHtml = `
    <div style="position: relative; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35)); display: flex; align-items: center; justify-content: center; width: 32px; height: 42px;">
      <svg width="32" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0ZM15 20.25C12.1005 20.25 9.75 17.8995 9.75 15C9.75 12.1005 12.1005 9.75 15 9.75C17.8995 9.75 20.25 12.1005 20.25 15C20.25 17.8995 17.8995 20.25 15 20.25Z" fill="#2563eb"/>
        <circle cx="15" cy="15" r="5" fill="white"/>
      </svg>
      <span style="position: absolute; width: 20px; height: 20px; background: rgba(37, 99, 235, 0.4); border-radius: 50%; animation: pulse-ping 1.5s infinite; z-index: -1;"></span>
    </div>
  `
  return L.divIcon({
    html: svgHtml,
    className: 'temp-marker-icon',
    iconSize: [32, 42],
    iconAnchor: [16, 42]
  })
}

// ─── Listener de clics ────────────────────────────────────────────────────────
function MapClickHandler({
  modoReporte,
  setCoordenadasSeleccionadas
}: {
  modoReporte: boolean
  setCoordenadasSeleccionadas: (coords: { lat: number; lng: number } | null) => void
}) {
  useMapEvents({
    click(e) {
      if (modoReporte) {
        setCoordenadasSeleccionadas({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    }
  })
  return null
}

// ─── Controlador de cámara (flyTo) ────────────────────────────────────────────
function MapController({
  reporteSeleccionado,
  coordenadasSeleccionadas
}: {
  reporteSeleccionado: Reporte | null
  coordenadasSeleccionadas: { lat: number; lng: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (
      reporteSeleccionado &&
      typeof reporteSeleccionado.latitud === 'number' &&
      typeof reporteSeleccionado.longitud === 'number' &&
      !isNaN(reporteSeleccionado.latitud) &&
      !isNaN(reporteSeleccionado.longitud)
    ) {
      map.flyTo([reporteSeleccionado.latitud, reporteSeleccionado.longitud], 14, {
        animate: true,
        duration: 1.2
      })
    }
  }, [reporteSeleccionado, map])

  useEffect(() => {
    if (
      coordenadasSeleccionadas &&
      !isNaN(coordenadasSeleccionadas.lat) &&
      !isNaN(coordenadasSeleccionadas.lng)
    ) {
      map.flyTo([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 14, {
        animate: true,
        duration: 1.2
      })
    }
  }, [coordenadasSeleccionadas, map])

  return null
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface MapaProps {
  reportes: Reporte[]
  reporteSeleccionado: Reporte | null
  modoReporte: boolean
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  setCoordenadasSeleccionadas: (coords: { lat: number; lng: number } | null) => void
  onMarkerClick: (reporte: Reporte) => void
}

// ─── Leyenda flotante ──────────────────────────────────────────────────────────
const leyendaItems = [
  { color: '#3b82f6', label: 'Refugio' },
  { color: '#ef4444', label: 'Centro Médico' },
  { color: '#78716c', label: 'Estructura caída' },
  { color: '#f97316', label: 'Peligro estructural' },
  { color: '#10b981', label: 'Centro Veterinario' },
]

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Mapa({
  reportes,
  reporteSeleccionado,
  modoReporte,
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onMarkerClick
}: MapaProps) {
  return (
    <div className="w-full h-full relative">
      <style jsx global>{`
        @keyframes pulse-ping {
          0%   { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .infra-marker-icon, .temp-marker-icon, .custom-marker-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>

      <MapContainer
        center={[8.0, -66.0]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <MapClickHandler modoReporte={modoReporte} setCoordenadasSeleccionadas={setCoordenadasSeleccionadas} />
        <MapController reporteSeleccionado={reporteSeleccionado} coordenadasSeleccionadas={coordenadasSeleccionadas} />

        {/* Marcadores por infraestructura */}
        {reportes
          .filter(r => !isNaN(Number(r.latitud)) && !isNaN(Number(r.longitud)))
          .map(reporte => {
            const icono = crearIconoInfraestructura(reporte.categoria_infraestructura)
            return (
              <Marker
                key={reporte.id}
                position={[Number(reporte.latitud), Number(reporte.longitud)]}
                icon={icono}
                eventHandlers={{ click: () => onMarkerClick(reporte) }}
              >
                <Popup>
                  <div className="text-xs font-sans p-1 text-slate-800 min-w-[160px]">
                    <div className="font-bold text-sm mb-1" style={{ color: coloresPorInfraestructura[reporte.categoria_infraestructura] || '#64748b' }}>
                      {reporte.categoria_infraestructura.replace('_', ' ')}
                    </div>
                    {reporte.direccion_texto && (
                      <p className="text-slate-500 text-[11px] mb-2 leading-tight">{reporte.direccion_texto}</p>
                    )}
                    {reporte.descripcion && (
                      <div className="border-t border-slate-100 pt-1.5 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Necesidades</span>
                        <p className="text-slate-700 text-[11px] leading-relaxed whitespace-pre-line">{reporte.descripcion}</p>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* Marcador temporal */}
        {modoReporte && coordenadasSeleccionadas && (
          <Marker
            position={[coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng]}
            icon={crearIconoTemporal()}
          >
            <Popup>
              <div className="text-xs text-center p-1">
                <strong>Ubicación seleccionada</strong>
                <p className="text-slate-500 mt-0.5">Completa el formulario.</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Leyenda flotante */}
      <div className="absolute bottom-6 right-3 z-[400] bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 pointer-events-none">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Leyenda</p>
        <div className="space-y-1.5">
          {leyendaItems.map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] font-medium text-slate-700 whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
