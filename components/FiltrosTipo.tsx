'use client'
import { Search, Filter, RotateCcw } from 'lucide-react'
import { CategoriaInfraestructura } from '@/types'

const CATEGORIAS: { valor: CategoriaInfraestructura; label: string; emoji: string }[] = [
  { valor: 'Refugio',             label: 'Refugio',             emoji: '🏠' },
  { valor: 'Centro Médico',       label: 'Centro Médico',       emoji: '🏥' },
  { valor: 'Estructura_caida',    label: 'Estructura Caída',    emoji: '🧱' },
  { valor: 'Peligro Estructural', label: 'Peligro Estructural', emoji: '⚠️' },
  { valor: 'Centro Veterinario',  label: 'Centro Veterinario',  emoji: '🐾' },
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
  setBusqueda,
}: FiltrosTipoProps) {
  const limpiarFiltros = () => {
    setFiltroInfraestructura('')
    setBusqueda('')
  }

  const hayFiltros = filtroInfraestructura !== '' || busqueda !== ''

  return (
    <div className="space-y-3">

      {/* Barra de búsqueda */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar dirección, estado, municipio..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                     text-slate-700 placeholder:text-slate-400 transition shadow-sm"
        />
      </div>

      {/* Chips de categoría */}
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
          <Filter size={10} /> Filtrar por tipo
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map(cat => {
            const activo = filtroInfraestructura === cat.valor
            return (
              <button
                key={cat.valor}
                onClick={() => setFiltroInfraestructura(activo ? '' : cat.valor)}
                className={`
                  flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold
                  border transition-all duration-150
                  ${activo
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                  }
                `}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Limpiar */}
      {hayFiltros && (
        <div className="flex justify-end">
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800
                       font-semibold py-1 px-2.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
          >
            <RotateCcw size={11} />
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
