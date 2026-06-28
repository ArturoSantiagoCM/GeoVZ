'use client'

import { ExternalLink, Map as MapIcon, List as ListIcon, Plus, HeartHandshake } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Reporte } from '@/types'
import dynamic from 'next/dynamic'
import FiltrosTipo from '@/components/FiltrosTipo'
import TarjetaReporte from '@/components/TarjetaReporte'
import FormularioReporte from '@/components/FormularioReporte'
import Image from 'next/image' 

const Mapa = dynamic(() => import('@/components/Mapa'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 border border-dashed border-slate-200">
      <p className="text-sm font-medium text-slate-400 animate-pulse">
        A carregar mapa de emergências...
      </p>
    </div>
  )
})

type MobileView = 'mapa' | 'lista' | 'reportar'

export default function Page() {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [vistaMobile, setVistaMobile] = useState<MobileView>('lista')

  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroInfraestructura, setFiltroInfraestructura] = useState('')
  const [busqueda, setBusqueda] = useState('')

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

  useEffect(() => {
    const obtenerReportesIniciales = async () => {
      try {
        const { data, error } = await supabase
          .from('reportes')
          .select('*')
          .order('creado_en', { ascending: false })

        if (error) console.error('Erro ao procurar registos:', error)
        else if (data) setReportes(data as Reporte[])
      } catch (err) {
        console.error('Erro crítico de rede:', err)
      } finaly {
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
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  const reportesAgrupadosParaMapa = useMemo(() => {
    if (!reportes || reportes.length === 0) return []
    const mapaAgrupado: { [key: string]: Reporte } = {}

    reportes.forEach((reporte) => {
      const latNum = Number(reporte.latitud)
      const lngNum = Number(reporte.longitud)
      if (isNaN(latNum) || isNaN(lngNum) || !reporte.latitud || !reporte.longitud) return
      
      const llaveCoordenada = `${latNum.toFixed(5)}_${lngNum.toFixed(5)}`

      if (mapaAgrupado[llaveCoordenada]) {
        mapaAgrupado[llaveCoordenada] = {
          ...mapaAgrupado[llaveCoordenada],
          descripcion: `${mapaAgrupado[llaveCoordenada].descripcion}\n\n⚠️ OUTRA NECESSIDADE AQUI:\n${reporte.descripcion || 'Sem descrição'}`,
          tipo_necesidad: 'Múltiples Necesidades' 
        }
      } else {
        mapaAgrupado[llaveCoordenada] = { 
          ...reporte,
          latitud: latNum,
          longitud: lngNum
        }
      }
    })

    return Object.values(mapaAgrupado)
  }, [reportes])

  const reportesFiltrados = useMemo(() => {
    if (!reportes) return []
    return reportes.filter((reporte) => {
      if (filtroTipo && reporte.tipo_necesidad !== filtroTipo) return false
      if (filtroInfraestructura && reporte.categoria_infraestructura !== filtroInfraestructura) return false
      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase()
        return (
          (reporte.descripcion && reporte.descripcion.toLowerCase().includes(query)) ||
          (reporte.estado && reporte.estado.toLowerCase().includes(query)) ||
          (reporte.municipio && reporte.municipio.toLowerCase().includes(query)) ||
          (reporte.direccion_texto && reporte.direccion_texto.toLowerCase().includes(query)) ||
          (reporte.tipo_necesidad && reporte.tipo_necesidad.toLowerCase().includes(query)) ||
          (reporte.categoria_infraestructura && reporte.categoria_infraestructura.toLowerCase().includes(query))
        )
      }
      return true
    })
  }, [reportes, filtroTipo, filtroInfraestructura, busqueda])

  const manejarSeleccionTarjeta = (reporte: Reporte) => {
    const lat = Number(reporte.latitud)
    const lng = Number(reporte.longitud)
    if (isNaN(lat) || isNaN(lng)) return

    setReporteSeleccionado({ ...reporte, latitud: lat, longitud: lng })
    setVistaMobile('mapa')
    
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 150)
    }
  }

  if (cargando) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 gap-4">
        <LoaderComponent />
        <p className="text-sm font-medium text-slate-400 animate-pulse px-4 text-center">
          A ligar à Rede de Emergência GeoVZ...
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans antialiased">
      {/* Navbar Superior */}
      <header className="h-14 sm:h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-2.5">
          <Image 
            src="/venezuela.png" 
            alt="Mapa de Venezuela"
            width={28} 
            height={28}
            className="object-contain shrink-0"
            priority
          />
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              GeoVZ <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Venezuela</span>
            </h1>
            <p className="text-[10px] text-slate-400 truncate">Plataforma Cidadã de Monitorização</p>
          </div>
        </div>
      </header>

      {/* Área Split de Conteúdo */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Painel Lateral */}
        <aside className={`
          w-full md:w-[390px] lg:w-[430px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden z-20
          ${vistaMobile === 'mapa' ? 'hidden md:flex' : 'flex'} 
          ${vistaMobile === 'lista' || vistaMobile === 'reportar' ? 'h-full' : 'h-0 md:h-full'}
        `}>
          
          <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 space-y-5 pb-24 md:pb-6">
            {modoReporte ? (
              <div className="animate-in fade-in duration-200">
                <FormularioReporte
                  coordenadasSeleccionadas={coordenadasSeleccionadas}
                  setCoordenadasSeleccionadas={setCoordenadasSeleccionadas}
                  onCancel={() => cambiarVistaMobile('lista')}
                  onSuccess={() => cambiarVistaMobile('mapa')}
                />
              </div>
            ) : (
              <>
                {/* Título Adaptado */}
                <div className="pb-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    ¿Dónde puedo donar?
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Consulta as necessidades críticas em tempo real.
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

                {/* Lista de Registos */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <span>Casos Registados</span>
                    <span className="text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      {reportesFiltrados.length}
                    </span>
                  </div>

                  <div className="space-y-2.5">
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
                      <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                        <HeartHandshake className="mx-auto text-slate-300" size={28} />
                        <h4 className="text-sm font-medium text-slate-500">Sem registos ativos</h4>
                      </div>
                    )}
                  </div>
                </div>

                {/* Links de Emergência */}
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Links Úteis de Ajuda</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href="https://redatudavenezuela.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-red-50/60 hover:bg-red-100/80 border border-red-100 rounded-xl text-xs font-semibold text-red-700 transition"
                    >
                      <span className="truncate">Red Ayuda</span>
                      <ExternalLink size={14} className="text-red-400 shrink-0 ml-1" />
                    </a>

                    <a
                      href="https://hospitalesenvenezuela.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-100 rounded-xl text-xs font-semibold text-blue-700 transition"
                    >
                      <span className="truncate">Hospitales</span>
                      <ExternalLink size={14} className="text-blue-400 shrink-0 ml-1" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Ecrã de Exibição do Mapa */}
        <main className={`
          flex-1 bg-slate-100 relative h-full z-10
          ${vistaMobile === 'mapa' ? 'block' : 'hidden md:block'}
        `}>
          {modoReporte && !coordenadasSeleccionadas && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-[92%] max-w-xs bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-base shrink-0">📍</span>
              <p className="text-xs font-medium leading-tight text-left text-slate-200">
                Toca no mapa no ponto exato para fixar o local.
              </p>
            </div>
          )}

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

      {/* Menu Inferior Estilo App Mobile Nativo */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-between px-6 z-[500] shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <button
          onClick={() => cambiarVistaMobile('lista')}
          className={`flex flex-col items-center justify-center w-20 h-full gap-1.5 transition-all ${
            vistaMobile === 'lista' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ListIcon size={20} className={vistaMobile === 'lista' ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
          <span className="text-[10px] tracking-wide font-medium">Ver Lista</span>
        </button>

        {/* Floating Action Button Centrado para o Novo Registro */}
        <div className="relative -top-4">
          <button
            onClick={() => cambiarVistaMobile('reportar')}
            className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform active:scale-95 ${
              vistaMobile === 'reportar' 
                ? 'bg-red-600 text-white ring-4 ring-red-100' 
                : 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-blue-500/20'
            }`}
          >
            <Plus size={28} className={`transition-transform duration-200 ${vistaMobile === 'reportar' ? 'rotate-45' : ''}`} />
          </button>
        </div>

        <button
          onClick={() => cambiarVistaMobile('mapa')}
          className={`flex flex-col items-center justify-center w-20 h-full gap-1.5 transition-all ${
            vistaMobile === 'mapa' ? 'text-blue-600 font-semibold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <MapIcon size={20} className={vistaMobile === 'mapa' ? 'stroke-[2.2]' : 'stroke-[1.8]'} />
          <span className="text-[10px] tracking-wide font-medium">Ver Mapa</span>
        </button>
      </nav>
    </div>
  )
}

function LoaderComponent() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="w-12 h-12 border-3 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="absolute animate-pulse">
        <Image 
          src="/venezuela.png" 
          alt="A carregar..."
          width={22} 
          height={22}
          className="object-contain"
        />
      </div>
    </div>
  )
}
