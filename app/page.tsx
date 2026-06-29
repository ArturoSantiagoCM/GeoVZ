'use client'

import {
  ExternalLink,
  Map as MapIcon,
  List as ListIcon,
  PlusCircle,
  HeartHandshake,
  AlertCircle,
} from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Reporte } from '@/types'
import dynamic from 'next/dynamic'
import FiltrosTipo from '@/components/FiltrosTipo'
import TarjetaReporte from '@/components/TarjetaReporte'
import FormularioReporte from '@/components/FormularioReporte'
import Image from 'next/image'

/* ── Leaflet solo en el cliente (no SSR) ─────────────────────── */
const Mapa = dynamic(() => import('@/components/Mapa'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-100">
      <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando mapa…</p>
    </div>
  ),
})

type MobileView = 'mapa' | 'lista' | 'reportar'

export default function Page() {
  const [reportes, setReportes]                                   = useState<Reporte[]>([])
  const [cargando, setCargando]                                   = useState(true)
  const [vistaMobile, setVistaMobile]                             = useState<MobileView>('lista')
  const [filtroTipo, setFiltroTipo]                               = useState('')
  const [filtroInfraestructura, setFiltroInfraestructura]         = useState('')
  const [busqueda, setBusqueda]                                   = useState('')
  const [reporteSeleccionado, setReporteSeleccionado]             = useState<Reporte | null>(null)
  const [modoReporte, setModoReporte]                             = useState(false)
  const [coordenadasSeleccionadas, setCoordenadasSeleccionadas]   = useState<{ lat: number; lng: number } | null>(null)

  /* ── Cambio de vista mobile ── */
  const cambiarVistaMobile = (vista: MobileView) => {
    setVistaMobile(vista)
    setModoReporte(vista === 'reportar')
    if (vista !== 'reportar') setCoordenadasSeleccionadas(null)
  }

  /* ── Carga inicial + realtime ── */
  useEffect(() => {
    const cargar = async () => {
      try {
        const { data, error } = await supabase
          .from('reportes')
          .select('*')
          .order('creado_en', { ascending: false })
        if (!error && data) setReportes(data as Reporte[])
      } catch (e) { console.error(e) }
      finally { setCargando(false) }
    }
    cargar()

    const channel = supabase
      .channel('reportes-nuevos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes' }, payload => {
        setReportes(prev => [payload.new as Reporte, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  /* ── Agrupación de coordenadas duplicadas ── */
  const reportesAgrupados = useMemo(() => {
    if (!reportes.length) return []
    const mapa: Record<string, Reporte> = {}
    reportes.forEach(r => {
      const lat = Number(r.latitud), lng = Number(r.longitud)
      if (isNaN(lat) || isNaN(lng)) return
      const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`
      if (mapa[key]) {
        mapa[key] = {
          ...mapa[key],
          descripcion: `${mapa[key].descripcion}\n\n⚠️ OTRA NECESIDAD:\n${r.descripcion || ''}`,
          tipo_necesidad: 'Múltiples Necesidades',
        }
      } else {
        mapa[key] = { ...r, latitud: lat, longitud: lng }
      }
    })
    return Object.values(mapa)
  }, [reportes])

  /* ── Filtros ── */
  const reportesFiltrados = useMemo(() => {
    return reportes.filter(r => {
      if (filtroTipo && r.tipo_necesidad !== filtroTipo) return false
      if (filtroInfraestructura && r.categoria_infraestructura !== filtroInfraestructura) return false
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        return [r.descripcion, r.estado, r.municipio, r.direccion_texto, r.tipo_necesidad, r.categoria_infraestructura]
          .some(v => v?.toLowerCase().includes(q))
      }
      return true
    })
  }, [reportes, filtroTipo, filtroInfraestructura, busqueda])

  /* ── Selección desde lista ── */
  const seleccionarTarjeta = (reporte: Reporte) => {
    const lat = Number(reporte.latitud), lng = Number(reporte.longitud)
    if (isNaN(lat) || isNaN(lng)) return
    // Primero cambiamos a la vista mapa (en mobile), luego el MapController
    // hace flyTo y abre el popup automáticamente tras el vuelo
    setVistaMobile('mapa')
    setModoReporte(false)
    setReporteSeleccionado({ ...reporte, latitud: lat, longitud: lng })
  }

  /* ── Actualizar descripción en el estado local tras guardar ── */
  const actualizarDescripcion = (id: string, descripcion: string) => {
    setReportes(prev =>
      prev.map(r => r.id === id ? { ...r, descripcion } : r)
    )
  }

  /* ── Loader ── */
  if (cargando) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute animate-pulse">
            <Image src="/venezuela.png" alt="Cargando…" width={24} height={24} className="object-contain" />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Conectando con GeoVZ…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 pb-16 md:pb-0">

      {/* ══ NAVBAR ══════════════════════════════════════════════ */}
      <header className="h-14 bg-slate-900 flex items-center justify-between px-4 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <Image src="/venezuela.png" alt="GeoVZ" width={28} height={28} className="object-contain shrink-0" priority />
          <div>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2 leading-none">
              GeoVZ
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/25 text-blue-400 border border-blue-500/30 font-bold tracking-wider">
                VENEZUELA
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Plataforma Ciudadana de Ayuda</p>
          </div>
        </div>

        {/* Contador en navbar */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-medium text-slate-300">{reportes.length} registros</span>
        </div>
      </header>

      {/* ══ CONTENIDO SPLIT ══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ── PANEL LATERAL ── */}
        <aside className={`
          w-full md:w-[380px] lg:w-[420px] bg-white border-r border-slate-200
          flex flex-col shrink-0 overflow-hidden z-10
          ${vistaMobile === 'mapa' ? 'hidden md:flex' : 'flex'}
          ${vistaMobile === 'lista' || vistaMobile === 'reportar' ? 'h-full' : 'h-0 md:h-full'}
        `}>

          <div className="flex-1 overflow-y-auto overscroll-contain">

            {modoReporte ? (
              <div className="p-4">
                <FormularioReporte
                  coordenadasSeleccionadas={coordenadasSeleccionadas}
                  setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
                  onCancel={() => cambiarVistaMobile('lista')}
                  onSuccess={() => cambiarVistaMobile('mapa')}
                />
              </div>
            ) : (
              <>
                {/* ── Encabezado ── */}
                <div className="px-4 pt-5 pb-4 border-b border-slate-100">
                  <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">
                    ¿DÓNDE<br/>DONAR?
                  </h2>
                  <p className="text-1x1 text-slate-500 mt-2 font-medium">
                    Necesidades críticas en tiempo real · Venezuela
                  </p>
                </div>

                {/* ── Filtros ── */}
                <div className="px-4 py-4 border-b border-slate-100">
                  <FiltrosTipo
                    filtroTipo={filtroTipo}
                    setFiltroTipo={setFiltroTipo}
                    filtroInfraestructura={filtroInfraestructura}
                    setFiltroInfraestructura={setFiltroInfraestructura}
                    busqueda={busqueda}
                    setBusqueda={setBusqueda}
                  />
                </div>

                {/* ── Lista ── */}
                <div className="px-4 py-4 space-y-3 pb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Casos registrados
                    </span>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                      {reportesFiltrados.length}
                    </span>
                  </div>

                  {reportesFiltrados.length > 0 ? (
                    reportesFiltrados.map(reporte => (
                      <TarjetaReporte
                        key={reporte.id}
                        reporte={reporte}
                        estaSeleccionado={reporteSeleccionado?.id === reporte.id}
                        onSelect={seleccionarTarjeta}
                        onUpdate={actualizarDescripcion}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                      <HeartHandshake size={32} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-bold text-slate-600">Sin registros activos</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {busqueda || filtroInfraestructura
                          ? 'Prueba cambiando los filtros'
                          : 'Aún no hay reportes registrados'}
                      </p>
                    </div>
                  )}
                </div>

                {/* ── Links de emergencia ── */}
                <div className="px-4 pb-6 space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Recursos de Ayuda
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="https://redayudavenezuela.com"
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-red-50 hover:bg-red-100
                                 border border-red-200 rounded-xl text-[11px] font-bold text-red-700 transition"
                    >
                      <span>Personar Desaparecidas</span>
                      <ExternalLink size={11} className="text-red-400 shrink-0" />
                    </a>
                    <a
                      href="https://hospitalesenvenezuela.com"
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100
                                 border border-blue-200 rounded-xl text-[11px] font-bold text-blue-700 transition"
                    >
                      <span>Personas en Hospitales</span>
                      <ExternalLink size={11} className="text-blue-400 shrink-0" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── MAPA ── */}
        <main className={`
          flex-1 relative
          ${vistaMobile === 'mapa' ? 'flex' : 'hidden md:flex'}
          flex-col
        `}
          style={{ minHeight: 0 }}
        >
          {/* Banner modo reporte */}
          {modoReporte && !coordenadasSeleccionadas && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-[450] flex items-center gap-2
                         bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-lg border border-blue-500/40
                         w-[90%] max-w-sm"
              style={{ animation: 'bounce-subtle 2s ease-in-out infinite' }}
            >
              <AlertCircle size={16} className="shrink-0" />
              <p className="text-xs font-bold leading-tight">
                Toca el mapa para marcar la ubicación exacta del lugar
              </p>
            </div>
          )}

          <div className="flex-1" style={{ minHeight: 0 }}>
            <Mapa
              reportes={reportesAgrupados}
              reporteSeleccionado={reporteSeleccionado}
              modoReporte={modoReporte}
              coordenadasSeleccionadas={coordenadasSeleccionadas}
              setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
              onMarkerClick={r => setReporteSeleccionado(r)}
            />
          </div>
        </main>
      </div>

      {/* ══ NAVEGACIÓN MOBILE ════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200
                      flex items-center justify-around z-[500] shadow-xl">
        <NavBtn
          active={vistaMobile === 'lista'}
          onClick={() => cambiarVistaMobile('lista')}
          icon={<ListIcon size={20} />}
          label="Ver Lista"
        />
        <NavBtn
          active={vistaMobile === 'mapa'}
          onClick={() => cambiarVistaMobile('mapa')}
          icon={<MapIcon size={20} />}
          label="Ver Mapa"
        />
        {/* Botón principal (FAB-style) */}
        <button
          onClick={() => cambiarVistaMobile('reportar')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors
            ${vistaMobile === 'reportar' ? 'text-blue-600' : 'text-slate-500'}`}
        >
          <PlusCircle
            size={24}
            className={vistaMobile === 'reportar' ? 'text-blue-600' : ''}
            strokeWidth={vistaMobile === 'reportar' ? 2.5 : 1.8}
          />
          <span className={`text-[10px] font-bold ${vistaMobile === 'reportar' ? 'text-blue-600' : 'text-slate-500'}`}>
            Registrar
          </span>
        </button>
      </nav>
    </div>
  )
}

/* ── Botón de nav reutilizable ── */
function NavBtn({
  active, onClick, icon, label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors
        ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
    >
      <span className={active ? '[&>svg]:stroke-[2.5]' : '[&>svg]:stroke-[1.8]'}>{icon}</span>
      <span className={`text-[10px] font-bold`}>{label}</span>
    </button>
  )
}
