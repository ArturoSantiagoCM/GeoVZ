'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { CategoriaInfraestructura } from '@/types'
import { MapPin, AlertTriangle, Check, Loader2, X, Search } from 'lucide-react'

const schemaReporte = z.object({
  categoria_infraestructura: z.string().min(1, { message: 'Selecciona un tipo de local' }),
  descripcion: z.string().min(1, { message: 'Describe al menos una necesidad del lugar' }).max(800)
})

type FormInputs = z.infer<typeof schemaReporte>

interface FormularioReporteProps {
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  setCoordenadasSeleccionadas: (coords: { lat: number; lng: number } | null) => void
  onSuccess: () => void
  onCancel: () => void
}

const categoriasInfraestructura: { valor: CategoriaInfraestructura; etiqueta: string; emoji: string }[] = [
  { valor: 'Refugio',             etiqueta: 'Refugio',                 emoji: '🏠' },
  { valor: 'Centro Médico',       etiqueta: 'Centro Médico',           emoji: '🏥' },
  { valor: 'Estructura_caida',    etiqueta: 'Estructura caída',        emoji: '🧱' },
  { valor: 'Peligro Estructural', etiqueta: 'Peligro Estructural',     emoji: '⚠️' },
  { valor: 'Centro Veterinario',  etiqueta: 'Centro Veterinario',      emoji: '🐾' },
]

export default function FormularioReporte({
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onSuccess,
  onCancel
}: FormularioReporteProps) {
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [buscandoDireccion, setBuscandoDireccion] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [cargandoDireccion, setCargandoDireccion] = useState(false)
  const [direccionResuelta, setDireccionResuelta] = useState<{
    direccion: string; estado: string; municipio: string
  } | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormInputs>({
    resolver: zodResolver(schemaReporte)
  })

  // Geocodificación inversa al seleccionar en el mapa
  useEffect(() => {
    if (!coordenadasSeleccionadas) { setDireccionResuelta(null); return }
    const geocodificar = async () => {
      setCargandoDireccion(true)
      try {
        const { lat, lng } = coordenadasSeleccionadas
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'es' } }
        )
        const data = await res.json()
        if (data?.address) {
          const a = data.address
          setDireccionResuelta({
            direccion: data.display_name || 'Ubicación seleccionada',
            estado: a.state || a.region || '',
            municipio: a.county || a.city || a.town || a.municipality || ''
          })
        } else {
          setDireccionResuelta({
            direccion: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
            estado: '', municipio: ''
          })
        }
      } catch {
        setDireccionResuelta({
          direccion: `Lat: ${coordenadasSeleccionadas.lat.toFixed(5)}, Lng: ${coordenadasSeleccionadas.lng.toFixed(5)}`,
          estado: '', municipio: ''
        })
      } finally { setCargandoDireccion(false) }
    }
    geocodificar()
  }, [coordenadasSeleccionadas])

  // Geocodificación directa: texto → coordenadas
  const manejarBusquedaDireccion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textoBusqueda.trim()) return
    setBuscandoDireccion(true)
    setErrorBusqueda(null)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(textoBusqueda)}&format=json&addressdetails=1&limit=1&countrycodes=ve`,
        { headers: { 'Accept-Language': 'es' } }
      )
      const data = await res.json()
      if (data?.length > 0) {
        setCoordenadasSeleccionadas({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
      } else {
        setErrorBusqueda('No se encontró en Venezuela. Intenta: "Altamira, Caracas" o "Maracay".')
      }
    } catch {
      setErrorBusqueda('Error de conexión. Inténtalo de nuevo.')
    } finally { setBuscandoDireccion(false) }
  }

  const onSubmit = async (data: FormInputs) => {
    if (!coordenadasSeleccionadas) {
      setErrorEnvio('Busca o selecciona una ubicación en el mapa primero.')
      return
    }
    setEnviando(true); setErrorEnvio(null)
    try {
      const { error } = await supabase.from('reportes').insert({
        latitud: coordenadasSeleccionadas.lat,
        longitud: coordenadasSeleccionadas.lng,
        tipo_necesidad: 'Múltiples Necesidades',
        categoria_infraestructura: data.categoria_infraestructura as CategoriaInfraestructura,
        descripcion: data.descripcion,
        contacto: null,
        direccion_texto: direccionResuelta?.direccion || 'Ubicación seleccionada',
        estado: direccionResuelta?.estado || null,
        municipio: direccionResuelta?.municipio || null,
        atendido: false,
        verificado: false
      })
      if (error) throw error
      reset(); setTextoBusqueda(''); onSuccess()
    } catch (err: unknown) {
      setErrorEnvio(err instanceof Error ? err.message : 'Error al guardar el reporte.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-5">
      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          Registrar Lugar con Necesidades
        </h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition">
          <X size={16} />
        </button>
      </div>

      {/* ── PASO 1: Buscar Dirección ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paso 1 — Ubicación del lugar</p>
        <form onSubmit={manejarBusquedaDireccion} className="flex gap-2">
          <input
            type="text"
            value={textoBusqueda}
            onChange={(e) => setTextoBusqueda(e.target.value)}
            placeholder="Ej: Altamira, Caracas..."
            className="flex-1 pl-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 transition"
          />
          <button
            type="submit"
            disabled={buscandoDireccion || !textoBusqueda.trim()}
            className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
          >
            {buscandoDireccion ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
            Buscar
          </button>
        </form>
        {errorBusqueda && <span className="text-[10px] text-red-500 font-medium block">{errorBusqueda}</span>}

        {/* Resultado */}
        <div className={`rounded-xl p-3 border text-[11px] transition-all ${coordenadasSeleccionadas ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-start gap-2">
            <MapPin size={14} className={coordenadasSeleccionadas ? 'text-blue-500 mt-0.5 shrink-0' : 'text-slate-400 mt-0.5 shrink-0'} />
            <div>
              {coordenadasSeleccionadas ? (
                cargandoDireccion ? (
                  <div className="flex items-center gap-1.5 text-slate-500"><Loader2 size={11} className="animate-spin" /> Buscando dirección...</div>
                ) : (
                  <>
                    <span className="font-bold text-slate-800 block">{direccionResuelta?.estado} — {direccionResuelta?.municipio}</span>
                    <span className="text-slate-500 line-clamp-2">{direccionResuelta?.direccion}</span>
                  </>
                )
              ) : (
                <span className="text-amber-600 font-medium animate-pulse">
                  ⚠️ Busca la dirección arriba o toca el mapa para fijar la ubicación
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ── PASO 2: Tipo de Local ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paso 2 — Tipo de Local</p>
          <div className="grid grid-cols-1 gap-2">
            {categoriasInfraestructura.map(cat => (
              <label key={cat.valor} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input
                  type="radio"
                  value={cat.valor}
                  {...register('categoria_infraestructura')}
                  className="accent-blue-600"
                />
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-sm font-semibold text-slate-700">{cat.etiqueta}</span>
              </label>
            ))}
          </div>
          {errors.categoria_infraestructura && (
            <span className="text-[10px] text-red-500 font-medium block">{errors.categoria_infraestructura.message}</span>
          )}
        </div>

        {/* ── PASO 3: Descripción libre ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paso 3 — Lista de Necesidades</p>
          <textarea
            {...register('descripcion')}
            placeholder={`Escribe qué se necesita en este lugar. Puedes listar varias cosas:\n\n- Agua potable\n- Medicamentos para hipertensión\n- Ropa de niños talla 4-8\n- 3 voluntarios de rescate`}
            rows={6}
            className={`w-full bg-white border rounded-lg px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none leading-relaxed ${errors.descripcion ? 'border-red-400' : 'border-slate-200'}`}
          />
          {errors.descripcion && (
            <span className="text-[10px] text-red-500 font-medium block">{errors.descripcion.message}</span>
          )}
        </div>

        {errorEnvio && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600 font-medium">{errorEnvio}</div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="w-1/2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !coordenadasSeleccionadas}
            className="w-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
          >
            {enviando ? <><Loader2 size={12} className="animate-spin" />Guardando...</> : <><Check size={12} />Guardar</>}
          </button>
        </div>
      </form>
    </div>
  )
}
