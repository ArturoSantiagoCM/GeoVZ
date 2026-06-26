'use client'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import { Reporte } from '@/types'

// IMPORTANTE: Leaflet requiere este fix de CSS en Next.js
// Agregar en globals.css:
// @import 'leaflet/dist/leaflet.css';

const coloresPorTipo = {
  'Agua': 'blue',
  'Comida': 'orangered',
  'Ropa': 'orange',
  'Medicamentos': 'purple',
  'Equipo de Rescate': 'red',
  'Equipo Médico': 'maroon',
  'Equipo Veterinario': 'pink',
  'Maquinaria de Rescate': 'tomate',
  'Objetos para Rescate': 'tomato'
}


export default function Mapa({ reportes }: { reportes: Reporte[] }) {
  return (
    <MapContainer
      center={[10.3946, -67.63242]} 
      zoom={7}
      style={{ height: '70vh', width: '80%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='© OpenStreetMap contributors'
      />
      {reportes.map(reporte => (
        <Marker
          key={reporte.id}
          position={[reporte.latitud, reporte.longitud]}
        >
          <Popup>
            <strong>{reporte.tipo_necesidad.toUpperCase()}</strong><br/>
            {reporte.descripcion}<br/>
            categoria_infraestructura
            Estado: {reporte.estado}<br/>
            Municipio: {reporte.municipio}<br/>
            Dirección: {reporte.direccion_texto}<br/>
            Contacto: {reporte.contacto}<br/>

          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}