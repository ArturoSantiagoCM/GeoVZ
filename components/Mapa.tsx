'use client'
import { useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { Reporte } from '@/types'
import L from 'leaflet'

/* ── Fix Leaflet icons en Next.js ────────────────────────────── */
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
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
      <div style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28));width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <svg width="44" height="44" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="15" fill="white" stroke="${c}" stroke-width="2.5"/>
          ${interior}
        </svg>
      </div>`,
    className: 'infra-marker-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
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

/* ── Controlador de cámara + invalidateSize al montar ────────── */
function MapController({
  reporteSeleccionado,
  coordenadasSeleccionadas,
  visible,
  abrirPopupRef,
}: {
  reporteSeleccionado: Reporte | null
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  visible: boolean
  abrirPopupRef: React.MutableRefObject<((id: string) => void) | null>
}) {
  const map = useMap()

  // Cada vez que el mapa se vuelve visible, forzar recálculo
  useEffect(() => {
    if (visible) {
      const t1 = setTimeout(() => map.invalidateSize({ animate: false }), 50)
      const t2 = setTimeout(() => map.invalidateSize({ animate: false }), 200)
      const t3 = setTimeout(() => map.invalidateSize({ animate: false }), 500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }
  }, [visible, map])

  useEffect(() => {
    const r = reporteSeleccionado
    if (r && !isNaN(Number(r.latitud)) && !isNaN(Number(r.longitud))) {
      map.flyTo([Number(r.latitud), Number(r.longitud)], 14, { animate: true, duration: 1.2 })
      // Abrir popup después del vuelo
      if (abrirPopupRef.current) {
        setTimeout(() => abrirPopupRef.current?.(r.id), 1300)
      }
    }
  }, [reporteSeleccionado, map, abrirPopupRef])

  useEffect(() => {
    const c = coordenadasSeleccionadas
    if (c && !isNaN(c.lat) && !isNaN(c.lng)) {
      map.flyTo([c.lat, c.lng], 14, { animate: true, duration: 1.2 })
    }
  }, [coordenadasSeleccionadas, map])

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
  visible?: boolean  // opcional — por defecto true
}

/* ── Componente principal ────────────────────────────────────── */
export default function Mapa({
  reportes,
  reporteSeleccionado,
  modoReporte,
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onMarkerClick,
  visible = true,
}: MapaProps) {
  // Refs para acceder a los marcadores y abrir sus popups programáticamente
  const markerRefs = useRef<Record<string, L.Marker | null>>({})
  // Ref para exponer la función abrirPopup al MapController
  const abrirPopupRef = useRef<((id: string) => void) | null>(null)

  const abrirPopup = useCallback((id: string) => {
    const marker = markerRefs.current[id]
    if (marker) marker.openPopup()
  }, [])

  useEffect(() => {
    abrirPopupRef.current = abrirPopup
  }, [abrirPopup])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

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
        .leaflet-popup-content-wrapper {
          border-radius: 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important;
          border: 1px solid #e2e8f0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .leaflet-popup-content { margin: 0 !important; min-width: 200px !important; }
        .leaflet-popup-close-button {
          color: white !important;
          font-size: 18px !important;
          padding: 8px 10px !important;
          top: 2px !important;
          right: 2px !important;
        }
        .leaflet-control-zoom a {
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
        }
        ${modoReporte ? '.leaflet-container { cursor: crosshair !important; }' : ''}
      `}</style>

      <MapContainer
        center={[8.0, -66.0]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        touchZoom={true}
        doubleClickZoom={true}
        scrollWheelZoom={true}
        dragging={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          keepBuffer={4}
          updateWhenIdle={false}
          updateWhenZooming={false}
        />

        <MapClickHandler
          modoReporte={modoReporte}
          setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
        />
        <MapController
          reporteSeleccionado={reporteSeleccionado}
          coordenadasSeleccionadas={coordenadasSeleccionadas}
          visible={visible}
          abrirPopupRef={abrirPopupRef}
        />

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
                ref={(ref) => { markerRefs.current[reporte.id] = ref }}
                eventHandlers={{ click: () => onMarkerClick(reporte) }}
              >
                <Popup maxWidth={280} minWidth={220}>
                  <div style={{ fontFamily: 'inherit' }}>
                    {/* Header colorido */}
                    <div style={{ backgroundColor: cfg.color, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
                        <div>
                          <span style={{ color: 'white', fontWeight: 800, fontSize: 14, display: 'block' }}>{cfg.label}</span>
                          {(reporte.estado || reporte.municipio) && (
                            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>
                              {[reporte.estado, reporte.municipio].filter(Boolean).join(' — ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Cuerpo */}
                    <div style={{ padding: '12px 16px' }}>
                      {reporte.direccion_texto && (
                        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10, lineHeight: 1.5, display: 'flex', gap: 4 }}>
                          <span>📍</span>
                          <span>{reporte.direccion_texto}</span>
                        </p>
                      )}
                      {reporte.descripcion && (
                        <div>
                          <p style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                            Necesidades
                          </p>
                          <p style={{ color: '#1e293b', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line', maxHeight: 180, overflowY: 'auto' }}>
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
              <div style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'inherit' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>📍 Ubicación seleccionada</p>
                <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Completa el formulario.</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Leyenda flotante */}
      {visible && (
        <div style={{
          position: 'absolute', bottom: 16, right: 10, zIndex: 400,
          backgroundColor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          borderRadius: 12, padding: '8px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          border: '1px solid #e2e8f0',
          pointerEvents: 'none',
        }}>
          <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 6 }}>
            Leyenda
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {LEYENDA.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  backgroundColor: item.color,
                  border: '2px solid white',
                  boxShadow: `0 0 0 1.5px ${item.color}55`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 10, color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {item.emoji} {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
