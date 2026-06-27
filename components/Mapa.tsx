'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { Reporte } from '@/types'

// Colores modernos y llamativos para el mapa
const coloresPorTipo: Record<string, string> = {
  'Agua': '#3b82f6',              
  'Comida': '#f97316',            
  'Ropa': '#eab308',              
  'Medicamentos': '#a855f7',      
  'Equipo de Rescate': '#ef4444',  
  'Equipo Médico': '#db2777',     
  'Equipo Veterinario': '#10b981',
  'Maquinaria de Rescate': '#4b5563', 
  'Objetos para Rescate': '#0d9488'  
}

// Helper para generar el HTML del Pin dinámico
const obtenerSvgHtml = (tipo: string) => {
  const color = coloresPorTipo[tipo] || '#ef4444'
  return `
    <div style="filter: drop-shadow(0px 1.5px 2.5px rgba(0,0,0,0.3)); display: flex; align-items: center; justify-content: center; width: 20px; height: 26px;">
      <svg width="20" height="26" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0ZM15 20.25C12.1005 20.25 9.75 17.8995 9.75 15C9.75 12.1005 12.1005 9.75 15 9.75C17.8995 9.75 20.25 12.1005 20.25 15C20.25 17.8995 17.8995 20.25 15 20.25Z" fill="${color}"/>
        <circle cx="15" cy="15" r="5" fill="white"/>
      </svg>
    </div>
  `
}

// Helper para generar el HTML del Pin temporal
const obtenerSvgTemporalHtml = () => {
  return `
    <div style="position: relative; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35)); display: flex; align-items: center; justify-content: center; width: 24px; height: 32px;">
      <svg width="24" height="32" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0ZM15 20.25C12.1005 20.25 9.75 17.8995 9.75 15C9.75 12.1005 12.1005 9.75 15 9.75C17.8995 9.75 20.25 12.1005 20.25 15C20.25 17.8995 17.8995 20.25 15 20.25Z" fill="#2563eb"/>
        <circle cx="15" cy="15" r="5" fill="white"/>
      </svg>
      <span style="position: absolute; width: 16px; height: 16px; background: rgba(37, 99, 235, 0.4); border-radius: 50%; animation: pulse-ping 1.5s infinite; z-index: -1;"></span>
    </div>
  `
}

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

function MapController({
  reporteSeleccionado,
  coordenadasSeleccionadas
}: {
  reporteSeleccionado: Reporte | null
  coordenadasSeleccionadas: { lat: number; lng: number } | null
}) {
  const map = useMap()

  useEffect(() => {
    if (reporteSeleccionado) {
      map.flyTo([reporteSeleccionado.latitud, reporteSeleccionado.longitud], 13, {
        animate: true,
        duration: 1.5
      })
    }
  }, [reporteSeleccionado, map])

  useEffect(() => {
    if (coordenadasSeleccionadas) {
      map.flyTo([coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng], 13, {
        animate: true,
        duration: 1.5
      })
    }
  }, [coordenadasSeleccionadas, map])

  return null
}

interface MapaProps {
  reportes: Reporte[]
  reporteSeleccionado: Reporte | null
  modoReporte: boolean
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  setCoordenadasSeleccionadas: (coords: { lat: number; lng: number } | null) => void
  onMarkerClick: (reporte: Reporte) => void
}

export default function Mapa({
  reportes,
  reporteSeleccionado,
  modoReporte,
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onMarkerClick
}: MapaProps) {
  // Instancia local de Leaflet guardada en el estado una vez cargado el cliente
  const [leafletInstance, setLeafletInstance] = useState<any>(null)

  useEffect(() => {
    // Importamos Leaflet de forma dinámica únicamente del lado del cliente
    import('leaflet').then((L) => {
      setLeafletInstance(L)
    })
  }, [])

  // Si Leaflet aún no se ha cargado en el cliente, mostramos fallback de carga segura
  if (!leafletInstance) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-400 animate-pulse">
          Inicializando entorno gráfico del mapa...
        </p>
      </div>
    )
  }

  // Generadores de íconos usando la instancia local segura
  const crearIconoPersonalizado = (tipo: string) => {
    return leafletInstance.divIcon({
      html: obtenerSvgHtml(tipo),
      className: 'custom-marker-icon',
      iconSize: [20, 26],
      iconAnchor: [10, 26],
      popupAnchor: [0, -26]
    })
  }

  const crearIconoTemporal = () => {
    return leafletInstance.divIcon({
      html: obtenerSvgTemporalHtml(),
      className: 'temp-marker-icon',
      iconSize: [24, 32],
      iconAnchor: [12, 32]
    })
  }

  return (
    <div className="w-full h-full relative">
      <style jsx global>{`
        @keyframes pulse-ping {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      <MapContainer
        center={[10.3946, -67.63242]} 
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapClickHandler
          modoReporte={modoReporte}
          setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
        />
        <MapController 
          reporteSeleccionado={reporteSeleccionado} 
          coordenadasSeleccionadas={coordenadasSeleccionadas} 
        />

        {reportes.map(reporte => {
          const icono = crearIconoPersonalizado(reporte.tipo_necesidad)
          return (
            <Marker
              key={reporte.id}
              position={[reporte.latitud, reporte.longitud]}
              icon={icono}
              eventHandlers={{
                click: () => onMarkerClick(reporte)
              }}
            >
              <Popup>
                <div className="text-sm font-sans p-1 text-slate-800">
                  <div className="font-bold border-b border-slate-100 pb-1 mb-1" style={{ color: coloresPorTipo[reporte.tipo_necesidad] || '#ef4444' }}>
                    {reporte.tipo_necesidad.toUpperCase()}
                  </div>
                  {reporte.descripcion && <p className="mb-2 italic text-slate-600">"{reporte.descripcion}"</p>}
                  <div className="text-xs space-y-1">
                    <div><strong>Infraestructura:</strong> {reporte.categoria_infraestructura.replace('_', ' ')}</div>
                    {reporte.estado && <div><strong>Estado:</strong> {reporte.estado}</div>}
                    {reporte.municipio && <div><strong>Municipio:</strong> {reporte.municipio}</div>}
                    {reporte.direccion_texto && <div><strong>Dirección:</strong> {reporte.direccion_texto}</div>}
                    {reporte.contacto && (
                      <div className="mt-2 pt-1 border-t border-slate-100">
                        <strong>Contacto:</strong> {reporte.contacto}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}

        {modoReporte && coordenadasSeleccionadas && (
          <Marker
            position={[coordenadasSeleccionadas.lat, coordenadasSeleccionadas.lng]}
            icon={crearIconoTemporal()}
          >
            <Popup>
              <div className="text-xs font-sans text-slate-800 p-1 text-center">
                <strong>Ubicación seleccionada</strong>
                <p className="text-slate-500 mt-1">Completa el formulario en la barra lateral para registrar el reporte.</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
