'use client'
import { Search, Filter, RotateCcw } from 'lucide-react'
import { CategoriaInfraestructura } from '@/types'

const categoriasInfraestructura: CategoriaInfraestructura[] = [
  'Estructura_caida',
  'Peligro Estructural',
  'Centro Médico',
  'Refugio',
  'Centro Veterinario'
]

interface FiltrosTipoProps {
  filtroTipo: string
  setFiltroTipo: (tipo: string) => void
  filtroInfraestructura: string
  setFiltroInfraestructura: (infra: string) => void
  busqueda: string
  setBusqueda: (busqueda: string) => void
}

export default function FiltrosTipo({
  filtroInfraestructura,
  setFiltroInfraestructura,
  busqueda,
  setBusqueda
}: FiltrosTipoProps) {
  const limpiarFiltros = () => {
    setFiltroInfraestructura('')
    setBusqueda('')
  }

  const tieneFiltrosActivos = filtroInfraestructura !== '' || busqueda !== ''

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
      {/* Barra de búsqueda */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar dirección o palabras clave..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition"
        />
      </div>

      {/* Selector Tipo de Local */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1">
          <Filter size={10} /> Filtrar por Tipo de Local
        </label>
        <select
          value={filtroInfraestructura}
          onChange={(e) => setFiltroInfraestructura(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
        >
          <option value="">Todos los locales</option>
          {categoriasInfraestructura.map((infra) => (
            <option key={infra} value={infra}>
              {infra.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {tieneFiltrosActivos && (
        <div className="flex justify-end pt-1">
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium py-1 px-2.5 bg-blue-50 hover:bg-blue-100 rounded-md transition"
          >
            <RotateCcw size={12} />
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
