'use client'

import { ExternalLink, Map as MapIcon, List as ListIcon, PlusCircle, ShieldAlert, HeartHandshake } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Reporte } from '@/types'
import dynamic from 'next/dynamic'
import FiltrosTipo from '@/components/FiltrosTipo'
import TarjetaReporte from '@/components/TarjetaReporte'
import FormularioReporte from '@/components/FormularioReporte'
import Image from 'next/image' 

// Cargamos el mapa desactivando estrictamente el SSR (Server-Side Rendering) para que Vercel no falle
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

type MobileView = 'mapa' | 'lista' | 'reportar'

export default function Page() {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [vistaMobile, setVistaMobile] = useState<MobileView>('lista')

  // Estados de Filtros
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroInfraestructura, setFiltroInfraestructura] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Estados de Interacción del Mapa
  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null)
  const [modoReporte, setModoReporte] = useState(false)
  const [coordenadasSeleccionadas, setCoordenadasSeleccionadas] = useState<{ lat: number; lng: number } | null>(null)

  const cambiarVistaMobile = (vista: MobileView) => {
    setVistaMobile(vista)
    if (vista === 'reportar') {
      setModoReporte(true)
    } else {
      setModoReporte(false)
      setCoordenadasSeleccionadas(null)
    }
  }

  // Cargar reportes iniciales y configurar canal en tiempo real
  useEffect(() => {
    const obtenerReportesIniciales = async () => {
      try {
        const { data, error } = await supabase
          .from('reportes')
          .select('*')
          .order('creado_en', { ascending: false })

        if (error) {
          console.error('Error al traer los reportes:', error)
        } else if (data) {
          setReportes(data as Reporte[])
        }
      } catch (err) {
        console.error('Error de conexión con Supabase:', err)
      } finally {
        setCargando(false)
      }
    }

    obtenerReportesIniciales()

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

  // Agrupar reportes en las mismas coordenadas exactas de forma segura
  const reportesAgrupadosParaMapa = useMemo(() => {
    if (!reportes.length) return []
    const mapaAgrupado: { [key: string]: Reporte } = {}

    reportes.forEach((reporte) => {
      const lat = Number(reporte.latitud || 0).toFixed(5)
      const lng = Number(reporte.longitud || 0).toFixed(5)
      const llaveCoordenada = `${lat}_${lng}`

      if (mapaAgrupado[llaveCoordenada]) {
        mapaAgrupado[llaveCoordenada] = {
          ...mapaAgrupado[llaveCoordenada],
          descripcion: `${mapaAgrupado[llaveCoordenada].descripcion} | OTRA NECESIDAD: ${reporte.descripcion}`,
          tipo_necesidad: mapaAgrupado[llaveCoordenada].tipo_necesidad === reporte.tipo_necesidad 
            ? mapaAgrupado[llaveCoordenada].tipo_necesidad 
            : 'Múltiples Necesidades'
        }
      } else {
        mapaAgrupado[llaveCoordenada] = { ...reporte }
      }
    })

    return Object.values(mapaAgrupado)
  }, [reportes])

  // Filtrar reportes para la visualización de la lista
  const reportesFiltrados = useMemo(() => {
    return reportes.filter((reporte) => {
      if (filtroTipo && reporte.tipo_necesidad !== filtroTipo) return false
      if (filtroInfraestructura && reporte.categoria_infraestructura !== filtroInfraestructura) return false
      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase()
        return (
          reporte.descripcion?.toLowerCase().includes(query) ||
          reporte.estado?.toLowerCase().includes(query) ||
          reporte.municipio?.toLowerCase().includes(query) ||
          reporte.direccion_texto?.toLowerCase().includes(query) ||
          reporte.tipo_necesidad.toLowerCase().includes(query) ||
          reporte.categoria_infraestructura.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [reportes, filtroTipo, filtroInfraestructura, busqueda])

  // Manejador protegido ante cambios de viewport para evitar el error de carga
  const manejarSeleccionTarjeta = (reporte: Reporte) => {
    setReporteSeleccionado(reporte)
    setVistaMobile('mapa')
    
    // Ejecutar redibujado asíncrono para asegurar que el contenedor de Leaflet ya sea visible
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 100)
    }
  }

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
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 font-sans pb-16 md:pb-0">
      {/* Cabecera / Navbar */}
      <header className="h-14 sm:h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-md z-20">
        <div className="flex items-center gap-3">
          <Image 
            src="/venezuela.png" 
            alt="Mapa de Venezuela"
            width={28} 
            height={28}
            className="object-contain shrink-0 sm:w-[32px] sm:h-[32px]"
            priority
          />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 truncate">
              GeoVZ <span className="text-[9px] sm:text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Venezuela</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">Plataforma Ciudadana de Monitoreo</p>
          </div>
        </div>
      </header>

      {/* Contenedor Principal Split */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Barra Lateral / Sidebar (Lista y Formulario) */}
        <aside className={`
          w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden shadow-sm z-10
          ${vistaMobile === 'mapa' ? 'hidden md:flex' : 'flex'} 
          ${vistaMobile === 'lista' || vistaMobile === 'reportar' ? 'h-full' : 'h-0 md:h-full'}
        `}>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24 md:pb-6">
            {modoReporte ? (
              <FormularioReporte
                coordenadasSeleccionadas={coordenadasSeleccionadas}
                setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
                onCancel={() => cambiarVistaMobile('lista')}
                onSuccess={() => cambiarVistaMobile('mapa')}
              />
            ) : (
              <>
                {/* TÍTULO RECONFIGURADO: Enorme, en mayúsculas y destacado */}
                <div className="py-2 border-b border-slate-100">
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tighter leading-none block">
                    ¿DONDE PUEDO DONAR?
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-2">
                    Consulta las necesidades críticas en tiempo real.
                  </p>
                </div>

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
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span>Casos Reportados</span>
                    <span className="text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
                      {reportesFiltrados.length}
                    </span>
                  </div>

                  {reportesFiltrados.length > 0 ? (
                    reportesFiltrados.map((reporte) => (
                      <TarjetaReporte
                        key={reporte.id}
                        reporte={reporte}
                        estaSeleccionado={reporteSeleccionado?.id === reporte.id}
                        onSelect={manejarSeleccionTarjeta}
                      />
                    ))
                  ) : (
                    <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
                      <HeartHandshake className="mx-auto text-slate-300" size={32} />
                      <h4 className="text-sm font-bold text-slate-700">Sin reportes activos</h4>
                    </div>
                  )}
                </div>

                {/* BOTONES DE ENLACES MOVIDOS AL FINAL DE LA LISTA */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Soporte y Enlaces de Emergencia</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href="https://redatudavenezuela.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[11px] font-bold text-red-700 transition shadow-sm"
                    >
                      <span className="truncate">Red Ayuda</span>
                      <ExternalLink size={12} className="text-red-400 shrink-0 ml-1" />
                    </a>

                    <a
                      href="https://hospitalesenvenezuela.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-700 transition shadow-sm"
                    >
                      <span className="truncate">Hospitales</span>
                      <ExternalLink size={12} className="text-blue-400 shrink-0 ml-1" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Panel del Mapa */}
        <main className={`
          flex-1 bg-slate-50 relative h-full
          ${vistaMobile === 'mapa' ? 'block' : 'hidden md:block'}
        `}>
          {modoReporte && !coordenadasSeleccionadas && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-sm bg-blue-600 text-white px-4 py-3 rounded-xl shadow-lg border border-blue-500/30 flex items-center gap-2 animate-bounce">
              <span className="text-base shrink-0">📍</span>
              <p className="text-xs font-bold leading-tight text-left">
                Toca el mapa en el punto del incidente para fijarlo.
              </p>
            </div>
          )}

          {/* DICCIONARIO / LEYENDA FLOTANTE DE COLORES EN EL MAPA */}
          <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-xl border border-slate-200 max-w-[220px] text-slate-800 space-y-2 pointer-events-auto">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Significado de Alertas</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0"></span>
                <span className="font-medium truncate text-slate-700">Maquinaria de Rescate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shrink-0"></span>
                <span className="font-medium truncate text-slate-700">Equipo de Rescatistas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                <span className="font-medium truncate text-slate-700">Insumos y Medicamentos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 inline-block shrink-0"></span>
                <span className="font-medium truncate text-slate-700">Múltiples Necesidades</span>
              </div>
            </div>
          </div>

          <Mapa
            reportes={reportesAgrupadosParaMapa}
            reporteSeleccionado={reporteSeleccionado}
            modoReporte={modoReporte}
            coordenadasSeleccionadas={coordenadasSeleccionadas}
            setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
            onMarkerClick={(reporte) => setReporteSeleccionado(reporte)}
          />
        </main>
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR (BOTTOM NAVIGATION) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-[500] shadow-xl">
        <button
          onClick={() => cambiarVistaMobile('lista')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
            vistaMobile === 'lista' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <ListIcon size={20} className={vistaMobile === 'lista' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="text-[10px] tracking-tight">Ver Lista</span>
        </button>

        <button
          onClick={() => cambiarVistaMobile('mapa')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
            vistaMobile === 'mapa' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <MapIcon size={20} className={vistaMobile === 'mapa' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="text-[10px] tracking-tight">Ver Mapa</span>
        </button>

        <button
          onClick={() => cambiarVistaMobile('reportar')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
            vistaMobile === 'reportar' ? 'text-red-600 font-bold' : 'text-slate-500'
          }`}
        >
          <PlusCircle size={20} className={vistaMobile === 'reportar' ? 'stroke-[2.5] text-red-600' : 'stroke-[1.8]'} />
          <span className="text-[10px] tracking-tight">Nuevo Reporte</span>
        </button>
      </nav>
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
