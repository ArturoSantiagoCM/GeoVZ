'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Reporte } from '@/types'
import { AlertCircle, Loader2, Map, List, Plus, X } from 'lucide-react'

// Importamos tus componentes modulares
import Mapa from '@/components/Mapa'
import TarjetaReporte from '@/components/TarjetaReporte'
import FiltrosTipo from '@/components/FiltrosTipo'
import FormularioReporte from '@/components/FormularioReporte'

export default function Home() {
  // ── Estados de Datos ────────────────────────────────────────────
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Estados de Interfaz / UX ────────────────────────────────────
  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null)
  const [modoReporte, setModoReporte] = useState(false)
  const [coordenadasSeleccionadas, setCoordenadasSeleccionadas] = useState<{ lat: number; lng: number } | null>(null)
  
  // SOLUCIÓN 1: La pantalla principal al abrir la app ahora es la LISTA
  const [vistaMobile, setVistaMobile] = useState<'mapa' | 'lista'>('lista')

  // ── Estados de Filtrado ─────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('')
  const [filtroInfraestructura, setFiltroInfraestructura] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  // SOLUCIÓN 2: Forzar a Leaflet a recalcular su tamaño al cambiar de pestaña en el celular
  useEffect(() => {
    if (vistaMobile === 'mapa' && typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 100)
    }
  }, [vistaMobile])

  // ── Cargar datos desde Supabase ─────────────────────────────────
  const cargarReportes = async () => {
    try {
      setCargando(true)
      setError(null)
      const { data, error: sbError } = await supabase
        .from('reportes')
        .select('*')
        .order('creado_en', { ascending: false })

      if (sbError) throw sbError
      setReportes(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los reportes')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarReportes()

    const canal = supabase
      .channel('cambios-reportes')
      .on(
        'postgres_changes',
        { event: '*', scheme: 'public', table: 'reportes' },
        () => { cargarReportes() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  // ── Filtrado en Memoria ─────────────────────────────────────────
  const reportesFiltrados = useMemo(() => {
    return reportes.filter((r) => {
      const cumpleInfra = filtroInfraestructura === '' || r.categoria_infraestructura === filtroInfraestructura
      const query = busqueda.toLowerCase().trim()
      const cumpleBusqueda =
        query === '' ||
        r.direccion_texto?.toLowerCase().includes(query) ||
        r.descripcion?.toLowerCase().includes(query) ||
        r.estado?.toLowerCase().includes(query) ||
        r.municipio?.toLowerCase().includes(query)

      return cumpleInfra && cumpleBusqueda
    })
  }, [reportes, filtroInfraestructura, busqueda])

  // ── Manejadores de Eventos ──────────────────────────────────────
  const manejarSeleccionarReporte = (reporte: Reporte) => {
    setReporteSeleccionado(reporte)
    setModoReporte(false)
    setVistaMobile('mapa') // Al tocar la tarjeta, abre el mapa directamente
  }

  const activarModoReporte = () => {
    setModoReporte(true)
    setReporteSeleccionado(null)
    setCoordenadasSeleccionadas(null)
    setVistaMobile('mapa') // El tab dedicado te manda al mapa para marcar el punto
  }

  const desactivarModoReporte = () => {
    setModoReporte(false)
    setCoordenadasSeleccionadas(null)
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden text-slate-800">
      {/* Navbar */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200">
            <span className="font-black text-sm tracking-tighter">🚨</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">AsistenciaVzla</h1>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Reportes Comunitarios en Tiempo Real</p>
          </div>
        </div>

        {!modoReporte ? (
          <button
            onClick={activarModoReporte}
            className="hidden md:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus size={14} /> Registrar Lugar
          </button>
        ) : (
          <button
            onClick={desactivarModoReporte}
            className="hidden md:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold transition"
          >
            <X size={14} /> Cancelar Registro
          </button>
        )}
      </header>

      {/* Cuerpo Split */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* COLUMNA IZQUIERDA: Lista */}
        <aside
          className={`
            w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-200/60 
            flex flex-col h-full shrink-0 z-20 md:static absolute inset-y-0 left-0 transition-transform duration-300
            ${vistaMobile === 'lista' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <div className="p-4 border-b border-slate-100 shrink-0 bg-slate-50/50 space-y-3">
            <FiltrosTipo
              filtroTipo={filtroTipo}
              setFiltroTipo={setFiltroTipo}
              filtroInfraestructura={filtroInfraestructura}
              setFiltroInfraestructura={setFiltroInfraestructura}
              busqueda={busqueda}
              setBusqueda={setBusqueda}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {modoReporte ? (
              <FormularioReporte
                coordenadasSeleccionadas={coordenadasSeleccionadas}
                setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
                onSuccess={() => {
                  desactivarModoReporte()
                  setVistaMobile('lista')
                }}
                onCancel={desactivarModoReporte}
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                    Lugares Encontrados ({reportesFiltrados.length})
                  </p>
                </div>

                {cargando ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                    <p className="text-xs font-medium">Cargando reportes activos...</p>
                  </div>
                ) : error ? (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Error de conexión</p>
                      <p className="mt-0.5 text-red-600/90">{error}</p>
                    </div>
                  </div>
                ) : reportesFiltrados.length === 0 ? (
                  <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-sm font-semibold text-slate-500">No hay resultados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reportesFiltrados.map((reporte) => (
                      <TarjetaReporte
                        key={reporte.id}
                        reporte={reporte}
                        onSelect={manejarSeleccionarReporte}
                        estaSeleccionado={reporteSeleccionado?.id === reporte.id}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* COLUMNA DERECHA: Mapa */}
        <main className="flex-1 h-full bg-slate-200 relative">
          {modoReporte && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] pointer-events-none w-[90%] sm:w-auto">
              <div className="bg-blue-600 border border-blue-500 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 animate-bounce">
                <span>📍</span>
                <span>Toca cualquier punto del mapa para fijar el reporte</span>
              </div>
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

      {/* MENÚ INFERIOR (MOBILE) */}
      <footer className="h-16 bg-white border-t border-slate-200 flex md:hidden shrink-0 z-30 shadow-inner justify-around items-center px-2">
        <button
          onClick={() => setVistaMobile('lista')}
          className={`flex flex-col items-center justify-center gap-1 w-20 h-full transition-colors ${
            vistaMobile === 'lista' ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <List size={18} />
          <span className="text-[10px]">Ver Lista</span>
        </button>

        {/* Tab dedicado a registrar */}
        <button
          onClick={modoReporte ? desactivarModoReporte : activarModoReporte}
          className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95 text-white ${
            modoReporte ? 'bg-slate-500 shadow-slate-200' : 'bg-blue-600 shadow-blue-200'
          }`}
        >
          {modoReporte ? <X size={20} /> : <Plus size={20} />}
        </button>

        <button
          onClick={() => setVistaMobile('mapa')}
          className={`flex flex-col items-center justify-center gap-1 w-20 h-full transition-colors ${
            vistaMobile === 'mapa' ? 'text-blue-600 font-bold' : 'text-slate-400 font-medium'
          }`}
        >
          <Map size={18} />
          <span className="text-[10px]">Ver Mapa</span>
        </button>
      </footer>
    </div>
  )
}
