
'use client'

import { ExternalLink } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Reporte } from '@/types'
import dynamic from 'next/dynamic'
import FiltrosTipo from '@/components/FiltrosTipo'
import TarjetaReporte from '@/components/TarjetaReporte'
import FormularioReporte from '@/components/FormularioReporte'
import Image from 'next/image' 
import { PlusCircle, List, ShieldAlert, HeartHandshake } from 'lucide-react'

// Cargamos el mapa desactivando el SSR (Server-Side Rendering)
const Mapa = dynamic(() => import('@/components/Mapa'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 border border-dashed border-slate-300">
      <p className="text-sm font-medium text-slate-400 animate-pulse">
        Cargando mapa de emergencias...
      </p>
    </div>
  )
})

export default function Page() {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(true)

  // Estados de Filtros
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroInfraestructura, setFiltroInfraestructura] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Estados de Interacción del Mapa
  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null)
  const [modoReporte, setModoReporte] = useState(false)
  const [coordenadasSeleccionadas, setCoordenadasSeleccionadas] = useState<{ lat: number; lng: number } | null>(null)

  // Cargar reportes iniciales y configurar canal en tiempo real
  useEffect(() => {
    const obtenerReportesIniciales = async () => {
      const { data, error } = await supabase
        .from('reportes')
        .select('*')
        .order('creado_en', { ascending: false })

      if (error) {
        console.error('Error al traer los reportes:', error)
      } else if (data) {
        setReportes(data as Reporte[])
      }
      setCargando(false)
    }

    obtenerReportesIniciales()

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('reportes-nuevos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reportes' },
        (payload) => {
          const nuevoReporte = payload.new as Reporte
          setReportes((prev) => [nuevoReporte, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Filtrar reportes en tiempo real
  const reportesFiltrados = useMemo(() => {
    return reportes.filter((reporte) => {
      if (filtroTipo && reporte.tipo_necesidad !== filtroTipo) {
        return false
      }
      if (filtroInfraestructura && reporte.categoria_infraestructura !== filtroInfraestructura) {
        return false
      }
      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase()
        const cumpleDescripcion = reporte.descripcion?.toLowerCase().includes(query) || false
        const cumpleEstado = reporte.estado?.toLowerCase().includes(query) || false
        const cumpleMunicipio = reporte.municipio?.toLowerCase().includes(query) || false
        const cumpleDireccion = reporte.direccion_texto?.toLowerCase().includes(query) || false
        const cumpleTipo = reporte.tipo_necesidad.toLowerCase().includes(query)
        const cumpleInfraestructura = reporte.categoria_infraestructura.toLowerCase().includes(query)

        if (
          !cumpleDescripcion &&
          !cumpleEstado &&
          !cumpleMunicipio &&
          !cumpleDireccion &&
          !cumpleTipo &&
          !cumpleInfraestructura
        ) {
          return false
        }
      }
      return true
    })
  }, [reportes, filtroTipo, filtroInfraestructura, busqueda])

  // Estadísticas rápidas
  const estadisticas = useMemo(() => {
    return {
      total: reportes.length,
      MaquiRescate: reportes.filter((r) => r.tipo_necesidad === 'Maquinaria de Rescate').length,
      EquiRescate: reportes.filter((r) => r.tipo_necesidad === 'Equipo de Rescate').length,
      salud: reportes.filter((r) => r.tipo_necesidad === 'Medicamentos' || r.tipo_necesidad === 'Equipo Médico').length
    }
  }, [reportes])

  if (cargando) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <LoaderComponent />
        <p className="text-sm font-semibold text-slate-600 animate-pulse px-4 text-center">
          Conectando con la Red de Emergencias GeoVZ...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 font-sans">
      {/* Cabecera / Navbar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3">
          <Image 
            src="/venezuela.png" 
            alt="Mapa de Venezuela"
            width={32} 
            height={32}
            className="object-contain shrink-0"
            priority
          />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 truncate">
              GeoVZ <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Venezuela</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Monitoreo de Crisis en Tiempo Real</p>
          </div>
        </div>

        {/* Stats de Cabecera - Ocultos en pantallas muy pequeñas, visibles desde sm */}
        <div className="hidden sm:flex items-center gap-4 md:gap-6">
          <div className="text-right">
            <span className="text-[9px] md:text-[10px] text-slate-400 uppercase block font-bold tracking-wider">Reportes Totales</span>
            <span className="text-xs md:text-sm font-bold text-white">{estadisticas.total}</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <span className="text-[9px] md:text-[10px] text-slate-400 uppercase block font-bold tracking-wider">Maquinaria</span>
            <span className="text-xs md:text-sm font-bold text-blue-400">{estadisticas.MaquiRescate}</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="text-right">
            <span className="text-[9px] md:text-[10px] text-slate-400 uppercase block font-bold tracking-wider">Rescatistas</span>
            <span className="text-xs md:text-sm font-bold text-orange-400">{estadisticas.EquiRescate}</span>
          </div>
        </div>
      </header>

      {/* Contenedor Principal Split (Sidebar + Mapa) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Barra Lateral (Sidebar) */}
        <aside className="w-full md:w-[380px] lg:w-[420px] bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col h-[45%] md:h-full shrink-0 overflow-hidden shadow-sm z-10">
          {/* Header del Sidebar */}
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              {modoReporte ? <ShieldAlert size={16} className="text-blue-500" /> : <List size={16} />}
              {modoReporte ? 'Crear Afectación' : 'Reportes Recientes'}
            </h2>
            
            <button
              onClick={() => {
                setModoReporte(!modoReporte)
                setCoordenadasSeleccionadas(null)
              }}
              className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                modoReporte
                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              }`}
            >
              {modoReporte ? (
                <>
                  <List size={14} />
                  Ver Reportes
                </>
              ) : (
                <>
                  <PlusCircle size={14} />
                  Reportar Incidente
                </>
              )}
            </button>
          </div>

          {/* Contenido Dinámico del Sidebar */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
            {modoReporte ? (
              <FormularioReporte
                coordenadasSeleccionadas={coordenadasSeleccionadas}
                setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
                onCancel={() => {
                  setModoReporte(false)
                  setCoordenadasSeleccionadas(null)
                }}
                onSuccess={() => {
                  setModoReporte(false)
                  setCoordenadasSeleccionadas(null)
                }}
              />
            ) : (
              <>
                {/* Botones de Enlaces Externos de Ayuda */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2">
                  <a
                    href="https://redatudavenezuela.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 sm:p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[11px] sm:text-xs font-bold text-red-700 transition shadow-sm group"
                  >
                    <span className="truncate">Red Ayuda VZLA</span>
                    <ExternalLink size={12} className="text-red-400 group-hover:text-red-600 transition-colors shrink-0 ml-1" />
                  </a>

                  <a
                    href="https://hospitalesenvenezuela.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 sm:p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-[11px] sm:text-xs font-bold text-blue-700 transition shadow-sm group"
                  >
                    <span className="truncate">Hospitales VZLA</span>
                    <ExternalLink size={12} className="text-blue-400 group-hover:text-blue-600 transition-colors shrink-0 ml-1" />
                  </a>
                </div>

                {/* Filtros */}
                <FiltrosTipo
                  filtroTipo={filtroTipo}
                  setFiltroTipo={setFiltroTipo}
                  filtroInfraestructura={filtroInfraestructura}
                  setFiltroInfraestructura={setFiltroInfraestructura}
                  busqueda={busqueda}
                  setBusqueda={setBusqueda}
                />

                {/* Lista de Tarjetas */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] sm:text-xs font-medium text-slate-500 px-1">
                    <span>Resultados de búsqueda</span>
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {reportesFiltrados.length}
                    </span>
                  </div>

                  {reportesFiltrados.length > 0 ? (
                    reportesFiltrados.map((reporte) => (
                      <TarjetaReporte
                        key={reporte.id}
                        reporte={reporte}
                        estaSeleccionado={reporteSeleccionado?.id === reporte.id}
                        onSelect={(rep) => setReporteSeleccionado(rep)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-6 sm:py-10 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
                      <HeartHandshake className="mx-auto text-slate-300" size={28} />
                      <h4 className="text-xs sm:text-sm font-bold text-slate-700">Sin reportes registrados</h4>
                      <p className="text-[11px] text-slate-500 leading-normal max-w-[240px] mx-auto">
                        No hay reportes activos que coincidan con estos filtros. Cambia tus términos de búsqueda o reporta uno nuevo.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Panel del Mapa */}
        <main className="flex-1 h-[55%] md:h-full bg-slate-50 relative">
          {/* Aviso Flotante si está en Modo Reporte */}
          {modoReporte && !coordenadasSeleccionadas && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] w-[92%] max-w-sm bg-blue-600 text-white px-3 py-2 rounded-xl shadow-lg border border-blue-500/30 flex items-center gap-2 animate-bounce">
              <span className="text-sm shrink-0">📍</span>
              <p className="text-[11px] font-bold leading-tight text-left">
                Haz clic en el mapa para fijar el punto del incidente y rellenar el formulario.
              </p>
            </div>
          )}

          <Mapa
            reportes={reportesFiltrados}
            reporteSeleccionado={reporteSeleccionado}
            modoReporte={modoReporte}
            coordenadasSeleccionadas={coordenadasSeleccionadas}
            setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
            onMarkerClick={(reporte) => setReporteSeleccionado(reporte)}
          />
        </main>
      </div>
    </div>
  )
}

function LoaderComponent() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="absolute animate-pulse">
        <Image 
          src="/venezuela.png" 
          alt="Cargando..."
          width={24} 
          height={24}
          className="object-contain"
        />
      </div>
    </div>
  )
}
