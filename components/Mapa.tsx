'use client'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Reporte } from '@/types'
import L from 'leaflet'

// Colores modernos y llamativos para el mapa
const coloresPorTipo: Record<string, string> = {
  'Agua': '#3b82f6',              // Azul moderno
  'Comida': '#f97316',            // Naranja moderno
  'Ropa': '#eab308',              // Amarillo
  'Medicamentos': '#a855f7',      // Púrpura
  'Equipo de Rescate': '#ef4444',  // Rojo
  'Equipo Médico': '#db2777',     // Rosa
  'Equipo Veterinario': '#10b981',// Verde
  'Maquinaria de Rescate': '#4b5563', // Gris oscuro
  'Objetos para Rescate': '#0d9488'  // Turquesa
}

// Función para crear un marcador dinámico moderno tipo Pin con SVG
const crearIconoPersonalizado = (tipo: string) => {
  const color = coloresPorTipo[tipo] || '#ef4444'
  
  const svgHtml = `
    <div style="filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.35)); display: flex; align-items: center; justify-content: center; width: 32px; height: 42px;">
      <svg width="32" height="42" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0ZM15 20.25C12.1005 20.25 9.75 17.8995 9.75 15C9.75 12.1005 12.1005 9.75 15 9.75C17.8995 9.75 20.25 12.1005 20.25 15C20.25 17.8995 17.8995 20.25 15 20.25Z" fill="${color}"/>
        <circle cx="15" cy="15" r="5" fill="white"/>
      </svg>
    </div>
  `
  
  return L.divIcon({
    html: svgHtml,
    className: 'custom-marker-icon',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
  })
}

export default function Mapa({ reportes }: { reportes: Reporte[] }) {
  return (
    <MapContainer
      center={[10.3946, -67.63242]} 
      zoom={7}
      style={{ height: '70vh', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {reportes.map(reporte => {
        const icono = crearIconoPersonalizado(reporte.tipo_necesidad)
        return (
          <Marker
            key={reporte.id}
            position={[reporte.latitud, reporte.longitud]}
            icon={icono}
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
    </MapContainer>
  )
}