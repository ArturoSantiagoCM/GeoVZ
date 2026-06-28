'use client'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { Reporte } from '@/types'
import L from 'leaflet'

/* ── Fix Leaflet icons en Next.js ────────────────────────────── */
// Sin esto, Leaflet no encuentra sus PNGs y los markers salen en gris
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl:     '/leaflet/marker-shadow.png',
})

/* ── Config visual por categoría ─────────────────────────────── */
const INFRA_CONFIG: Record<string, { color: string; emoji: string; label: string }> = {
  'Refugio':             { color: '#2563eb', emoji: '🏠', label: 'Refugio' },
  'Centro Médico':       { color: '#dc2626', emoji: '🏥', label: 'Centro Médico' },
  'Estructura_caida':    { color: '#78716c', emoji: '🧱', label: 'Estructura Caída' },
  'Peligro Estructural': { color: '#ea580c', emoji: '⚠️', label: 'Peligro Estructural' },
  'Centro Veterinario':  { color: '#059669', emoji: '🐾', label: 'Centro Veterinario' },
}

const LEYENDA = [
  { color: '#2563eb', emoji: '🏠', label: 'Refugio' },
  { color: '#dc2626', emoji: '🏥', label: 'Centro Médico' },
  { color: '#78716c', emoji: '🧱', label: 'Estructura Caída' },
  { color: '#ea580c', emoji: '⚠️', label: 'Peligro Estructural' },
  { color: '#059669', emoji: '🐾', label: 'Centro Veterinario' },
]

/* ── Icono SVG por categoría ─────────────────────────────────── */
const crearIconoInfraestructura = (categoria: string): L.DivIcon => {
  const cfg = INFRA_CONFIG[categoria] ?? { color: '#64748b', emoji: '📍', label: categoria }
  const c = cfg.color

  const svgInterior: Record<string, string> = {
    'Refugio': `
      <polygon points="16,4 28,14 28,28 4,28" fill="${c}" stroke="white" stroke-width="1.2"/>
      <rect x="11" y="18" width="10" height="10" fill="white" opacity="0.9"/>
      <polygon points="16,4 4,14 28,14" fill="${c}" stroke="white" stroke-width="1.2"/>
    `,
    'Centro Médico': `
      <rect x="3" y="3" width="26" height="26" rx="5" fill="${c}"/>
      <rect x="13" y="7" width="6" height="18" fill="white"/>
      <rect x="7" y="13" width="18" height="6" fill="white"/>
    `,
    'Estructura_caida': `
      <polygon points="4,28 12,8 20,22 26,12 28,28" fill="${c}" stroke="white" stroke-width="1"/>
      <line x1="2" y1="28" x2="28" y2="28" stroke="white" stroke-width="2"/>
    `,
    'Peligro Estructural': `
      <polygon points="16,3 29,26 3,26" fill="${c}" stroke="white" stroke-width="1.5"/>
      <rect x="14.5" y="12" width="3" height="8" rx="1" fill="white"/>
      <circle cx="16" cy="23" r="1.5" fill="white"/>
    `,
    'Centro Veterinario': `
      <ellipse cx="16" cy="18" rx="8" ry="9" fill="${c}"/>
      <ellipse cx="8"  cy="9"  rx="4" ry="5" fill="${c}"/>
      <ellipse cx="16" cy="6"  rx="4" ry="5" fill="${c}"/>
      <ellipse cx="24" cy="9"  rx="4" ry="5" fill="${c}"/>
    `,
  }

  const interior = svgInterior[categoria] ?? `<circle cx="16" cy="16" r="10" fill="${c}"/>`

  return L.divIcon({
    html: `
      <div style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28));width:38px;height:38px;display:flex;align-items:center;justify-content:center;">
        <svg width="38" height="38" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="15" fill="white" stroke="${c}" stroke-width="2.5"/>
          ${interior}
        </svg>
      </div>`,
    className: 'infra-marker-icon',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  })
}

/* ── Icono temporal ──────────────────────────────────────────── */
const crearIconoTemporal = (): L.DivIcon =>
  L.divIcon({
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:44px;">
        <div style="position:absolute;width:22px;height:22px;background:rgba(37,99,235,0.3);border-radius:50%;
                    animation:pulse-ping 1.5s ease-out infinite;top:3px;left:6px;"></div>
        <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 1C8.163 1 1 8.163 1 17C1 29.25 17 43 17 43C17 43 33 29.25 33 17C33 8.163 25.837 1 17 1Z"
                fill="#2563eb" stroke="white" stroke-width="1.5"/>
          <circle cx="17" cy="17" r="6" fill="white"/>
          <circle cx="17" cy="17" r="3" fill="#2563eb"/>
        </svg>
      </div>`,
    className: 'temp-marker-icon',
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -46],
  })

/* ── Listener de clicks ──────────────────────────────────────── */
function MapClickHandler({
  modoReporte,
  setCoordenadasSeleccionadas,
}: {
  modoReporte: boolean
  setCoordenadasSeleccionadas: (c: { lat: number; lng: number } | null) => void
}) {
  useMapEvents({
    click(e) {
      if (modoReporte) setCoordenadasSeleccionadas({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

/* ── Controlador de cámara ───────────────────────────────────── */
function MapController({
  reporteSeleccionado,
  coordenadasSeleccionadas,
}: {
  reporteSeleccionado: Reporte | null
  coordenadasSeleccionadas: { lat: number; lng: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    const r = reporteSeleccionado
    if (r && !isNaN(Number(r.latitud)) && !isNaN(Number(r.longitud))) {
      map.flyTo([Number(r.latitud), Number(r.longitud)], 14, { animate: true, duration: 1.2 })
    }
  }, [reporteSeleccionado, map])

  useEffect(() => {
    const c = coordenadasSeleccionadas
    if (c && !isNaN(c.lat) && !isNaN(c.lng)) {
      map.flyTo([c.lat, c.lng], 14, { animate: true, duration: 1.2 })
    }
  }, [coordenadasSeleccionadas, map])

  return null
}

/* ── Hook: altura real del viewport en mobile ────────────────── */
function useMapHeight(navbarH: number, bottomNavH: number) {
  const [height, setHeight] = useState<string>('100%')

  useEffect(() => {
    const calcular = () => {
      // dvh (dynamic viewport height) resuelve el bug de iOS Safari con la barra de URL
      const dvhSoportado = CSS.supports('height', '1dvh')
      if (dvhSoportado) {
        // En mobile descontamos navbar + barra de nav inferior
        const isMobile = window.innerWidth < 768
        setHeight(isMobile
          ? `calc(100dvh - ${navbarH + bottomNavH}px)`
          : '100%')
      } else {
        // Fallback: usar window.innerHeight real
        const isMobile = window.innerWidth < 768
        setHeight(isMobile
          ? `${window.innerHeight - navbarH - bottomNavH}px`
          : '100%')
      }
    }

    calcular()
    window.addEventListener('resize', calcular)
    // En iOS, orientationchange puede llegar antes que resize
    window.addEventListener('orientationchange', () => setTimeout(calcular, 200))

    return () => {
      window.removeEventListener('resize', calcular)
      window.removeEventListener('orientationchange', calcular)
    }
  }, [navbarH, bottomNavH])

  return height
}

/* ── Forzar recálculo de tamaño cuando cambia el contenedor ─── */
function MapResizer({ mapHeight }: { mapHeight: string }) {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 50)
  }, [mapHeight, map])
  return null
}

/* ── Props ───────────────────────────────────────────────────── */
interface MapaProps {
  reportes: Reporte[]
  reporteSeleccionado: Reporte | null
  modoReporte: boolean
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  setCoordenadasSeleccionadas: (c: { lat: number; lng: number } | null) => void
  onMarkerClick: (reporte: Reporte) => void
}

/* ── Componente principal ────────────────────────────────────── */
export default function Mapa({
  reportes,
  reporteSeleccionado,
  modoReporte,
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onMarkerClick,
}: MapaProps) {
  // 56px navbar + 64px bottom nav mobile
  const mapHeight = useMapHeight(56, 64)

  return (
    <div style={{ width: '100%', height: mapHeight, position: 'relative', minHeight: 200 }}>

      <style>{`
        @keyframes pulse-ping {
          0%   { transform: scale(0.5); opacity: 0.9; }
          100% { transform: scale(3);   opacity: 0; }
        }
        .infra-marker-icon,
        .temp-marker-icon {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-container {
          font-family: inherit;
          background: #e2e8f0;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
          border: 1px solid #e2e8f0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .leaflet-popup-content { margin: 0 !important; }
        ${modoReporte ? '.leaflet-container { cursor: crosshair !important; }' : ''}
      `}</style>

      <MapContainer
        center={[8.0, -66.0]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <MapClickHandler
          modoReporte={modoReporte}
          setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
        />
        <MapController
          reporteSeleccionado={reporteSeleccionado}
          coordenadasSeleccionadas={coordenadasSeleccionadas}
        />
        <MapResizer mapHeight={mapHeight} />

        {/* Marcadores */}
        {reportes
          .filter(r => !isNaN(Number(r.latitud)) && !isNaN(Number(r.longitud)))
          .map(reporte => {
            const cfg = INFRA_CONFIG[reporte.categoria_infraestructura] ?? { color: '#64748b', emoji: '📍', label: reporte.categoria_infraestructura }
            return (
              <Marker
                key={reporte.id}
                position={[Number(reporte.latitud), Number(reporte.longitud)]}
                icon={crearIconoInfraestructura(reporte.categoria_infraestructura)}
                eventHandlers={{ click: () => onMarkerClick(reporte) }}
              >
                <Popup>
                  <div style={{ fontFamily: 'inherit', minWidth: 180, maxWidth: 240 }}>
                    <div style={{ backgroundColor: cfg.color, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{cfg.label}</span>
                      </div>
                      {(reporte.estado || reporte.municipio) && (
                        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 }}>
                          {[reporte.estado, reporte.municipio].filter(Boolean).join(' — ')}
                        </p>
                      )}
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      {reporte.direccion_texto && (
                        <p style={{ color: '#64748b', fontSize: 11, marginBottom: 8, lineHeight: 1.4 }}>
                          📍 {reporte.direccion_texto}
                        </p>
                      )}
                      {reporte.descripcion && (
                        <div>
                          <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                            Necesidades
                          </p>
                          <p style={{ color: '#1e293b', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                            {reporte.descripcion}
                          </p>
                        </div>
                      )}
                    </div>
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
              <div style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'inherit' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>📍 Ubicación seleccionada</p>
                <p style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Completa el formulario.</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Leyenda flotante */}
      <div style={{
        position: 'absolute', bottom: 16, right: 10, zIndex: 400,
        backgroundColor: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14, padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0',
        pointerEvents: 'none',
      }}>
        <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 8 }}>
          Leyenda
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LEYENDA.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                backgroundColor: item.color,
                border: '2px solid white',
                boxShadow: `0 0 0 1.5px ${item.color}55`,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {item.emoji} {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
