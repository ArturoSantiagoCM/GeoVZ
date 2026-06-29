'use client'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { CategoriaInfraestructura } from '@/types'
import { MapPin, AlertTriangle, Check, Loader2, X, Search, LocateFixed } from 'lucide-react'

const schemaReporte = z.object({
  categoria_infraestructura: z.string().min(1, { message: 'Selecciona un tipo de local' }),
  descripcion: z.string().min(1, { message: 'Describe al menos una necesidad' }).max(800),
})

type FormInputs = z.infer<typeof schemaReporte>

interface Sugerencia {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address: {
    state?: string
    region?: string
    county?: string
    city?: string
    town?: string
    municipality?: string
  }
}

interface FormularioReporteProps {
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  setCoordenadasSeleccionadas: (coords: { lat: number; lng: number } | null) => void
  onSuccess: () => void
  onCancel: () => void
}

const CATEGORIAS: { valor: CategoriaInfraestructura; etiqueta: string; emoji: string }[] = [
  { valor: 'Refugio',             etiqueta: 'Refugio',              emoji: '🏠' },
  { valor: 'Centro Médico',       etiqueta: 'Centro Médico',        emoji: '🏥' },
  { valor: 'Estructura_caida',    etiqueta: 'Estructura caída',     emoji: '🧱' },
  { valor: 'Peligro Estructural', etiqueta: 'Peligro Estructural',  emoji: '⚠️' },
  { valor: 'Centro Veterinario',  etiqueta: 'Centro Veterinario',   emoji: '🐾' },
]

export default function FormularioReporte({
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onSuccess,
  onCancel,
}: FormularioReporteProps) {
  const [enviando, setEnviando]           = useState(false)
  const [errorEnvio, setErrorEnvio]       = useState<string | null>(null)

  // ── Geolocalización ─────────────────────────────────────────────
  const [geoEstado, setGeoEstado] = useState<'idle' | 'cargando' | 'error'>('idle')
  const [geoError, setGeoError]   = useState<string | null>(null)

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización.')
      setGeoEstado('error')
      return
    }
    setGeoEstado('cargando')
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setCoordenadasSeleccionadas({ lat, lng })
        setDireccionResuelta(null) // forzar geocodificación inversa
        setGeoEstado('idle')
      },
      (err) => {
        setGeoEstado('error')
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Permiso denegado. Activa la ubicación en tu navegador.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('No se pudo obtener tu ubicación. Intenta de nuevo.')
        } else {
          setGeoError('Tiempo de espera agotado. Intenta de nuevo.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // ── Autocompletado ──────────────────────────────────────────────
  const [textoBusqueda, setTextoBusqueda]         = useState('')
  const [sugerencias, setSugerencias]             = useState<Sugerencia[]>([])
  const [buscando, setBuscando]                   = useState(false)
  const [dropdownAbierto, setDropdownAbierto]     = useState(false)
  const debounceRef                               = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                                = useRef<HTMLDivElement>(null)

  // ── Dirección resuelta ──────────────────────────────────────────
  const [cargandoDireccion, setCargandoDireccion]   = useState(false)
  const [direccionResuelta, setDireccionResuelta]   = useState<{
    direccion: string; estado: string; municipio: string
  } | null>(null)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormInputs>({
    resolver: zodResolver(schemaReporte),
  })

  // ── Cerrar dropdown al hacer click fuera ────────────────────────
  useEffect(() => {
    const handleClickFuera = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  // ── Debounce: buscar sugerencias mientras escribe ───────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const query = textoBusqueda.trim()

    if (query.length < 3) {
      setSugerencias([])
      setDropdownAbierto(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=ve`,
          { headers: { 'Accept-Language': 'es' } }
        )
        const data: Sugerencia[] = await res.json()
        setSugerencias(data)
        setDropdownAbierto(data.length > 0)
      } catch {
        setSugerencias([])
      } finally {
        setBuscando(false)
      }
    }, 400) // 400ms debounce

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [textoBusqueda])

  // ── Al seleccionar una sugerencia ───────────────────────────────
  const seleccionarSugerencia = (s: Sugerencia) => {
    const lat = parseFloat(s.lat)
    const lng = parseFloat(s.lon)
    const a = s.address

    // Tomar solo la primera parte del display_name para el campo de texto
    const nombreCorto = s.display_name.split(',').slice(0, 3).join(',').trim()
    setTextoBusqueda(nombreCorto)

    setCoordenadasSeleccionadas({ lat, lng })
    setDireccionResuelta({
      direccion: s.display_name,
      estado: a.state || a.region || '',
      municipio: a.county || a.city || a.town || a.municipality || '',
    })
    setSugerencias([])
    setDropdownAbierto(false)
  }

  // ── Geocodificación inversa al tocar el mapa ────────────────────
  useEffect(() => {
    if (!coordenadasSeleccionadas) { setDireccionResuelta(null); return }

    // Si ya tenemos dirección (seleccionada del dropdown), no re-geocodificar
    if (direccionResuelta) return

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
          const nombreCorto = data.display_name.split(',').slice(0, 3).join(',').trim()
          setTextoBusqueda(nombreCorto)
          setDireccionResuelta({
            direccion: data.display_name,
            estado: a.state || a.region || '',
            municipio: a.county || a.city || a.town || a.municipality || '',
          })
        } else {
          setDireccionResuelta({
            direccion: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            estado: '', municipio: '',
          })
        }
      } catch {
        setDireccionResuelta({
          direccion: `${coordenadasSeleccionadas.lat.toFixed(5)}, ${coordenadasSeleccionadas.lng.toFixed(5)}`,
          estado: '', municipio: '',
        })
      } finally {
        setCargandoDireccion(false)
      }
    }
    geocodificar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordenadasSeleccionadas])

  // ── Limpiar ubicación ───────────────────────────────────────────
  const limpiarUbicacion = () => {
    setTextoBusqueda('')
    setSugerencias([])
    setDropdownAbierto(false)
    setDireccionResuelta(null)
    setCoordenadasSeleccionadas(null)
  }

  // ── Envío del formulario ────────────────────────────────────────
  const onSubmit = async (data: FormInputs) => {
    if (!coordenadasSeleccionadas) {
      setErrorEnvio('Busca o selecciona una ubicación en el mapa primero.')
      return
    }
    setEnviando(true); setErrorEnvio(null)
    try {
      const { error } = await supabase.from('reportes').insert({
        latitud:                  coordenadasSeleccionadas.lat,
        longitud:                 coordenadasSeleccionadas.lng,
        tipo_necesidad:           'Múltiples Necesidades',
        categoria_infraestructura: data.categoria_infraestructura as CategoriaInfraestructura,
        descripcion:              data.descripcion,
        contacto:                 null,
        direccion_texto:          direccionResuelta?.direccion || 'Ubicación seleccionada',
        estado:                   direccionResuelta?.estado || null,
        municipio:                direccionResuelta?.municipio || null,
        atendido:                 false,
        verificado:               false,
      })
      if (error) throw error
      reset()
      setTextoBusqueda('')
      setDireccionResuelta(null)
      onSuccess()
    } catch (err: unknown) {
      setErrorEnvio(err instanceof Error ? err.message : 'Error al guardar el reporte.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm space-y-5 overflow-hidden">

      {/* Header */}
      <div className="flex justify-between items-center px-5 pt-5 pb-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle size={19} className="text-amber-500 shrink-0" />
          Registrar lugar con necesidades
        </h2>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-5 pb-5 space-y-5">

        {/* ── PASO 1: Ubicación con autocompletado ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">1</span>
            Ubicación del lugar
          </p>

          {/* Input con autocompletado */}
          <div ref={wrapperRef} className="relative">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={textoBusqueda}
                onChange={e => {
                  setTextoBusqueda(e.target.value)
                  // Si edita manualmente, limpiar coords
                  if (coordenadasSeleccionadas) {
                    setCoordenadasSeleccionadas(null)
                    setDireccionResuelta(null)
                  }
                }}
                onFocus={() => sugerencias.length > 0 && setDropdownAbierto(true)}
                placeholder="Ej: Altamira, Caracas · Las Mercedes · Maracay…"
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-slate-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                           text-slate-700 placeholder:text-slate-400 transition"
              />
              {/* Indicador: buscando o limpiar */}
              <div className="absolute right-3">
                {buscando ? (
                  <Loader2 size={14} className="text-blue-500 animate-spin" />
                ) : textoBusqueda ? (
                  <button
                    type="button"
                    onClick={limpiarUbicacion}
                    className="text-slate-400 hover:text-slate-600 transition"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Dropdown de sugerencias */}
            {dropdownAbierto && sugerencias.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[600] overflow-hidden">
                {sugerencias.map((s, i) => {
                  const partes = s.display_name.split(',')
                  const nombre = partes.slice(0, 2).join(',').trim()
                  const detalle = partes.slice(2, 4).join(',').trim()
                  return (
                    <button
                      key={s.place_id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); seleccionarSugerencia(s) }}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition
                        ${i < sugerencias.length - 1 ? 'border-b border-slate-100' : ''}`}
                    >
                      <MapPin size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{nombre}</p>
                        {detalle && (
                          <p className="text-[10px] text-slate-400 truncate">{detalle}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Sin resultados */}
            {dropdownAbierto && !buscando && sugerencias.length === 0 && textoBusqueda.length >= 3 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-[600] px-4 py-3">
                <p className="text-xs text-slate-500 text-center">
                  Sin resultados en Venezuela para <strong>"{textoBusqueda}"</strong>
                </p>
              </div>
            )}
          </div>

          {/* Botón usar mi ubicación */}
          <button
            type="button"
            onClick={usarMiUbicacion}
            disabled={geoEstado === 'cargando'}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-green-200
                       bg-green-50 hover:bg-green-100 text-green-700 font-bold text-xs transition
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {geoEstado === 'cargando' ? (
              <><Loader2 size={14} className="animate-spin" /> Obteniendo ubicación…</>
            ) : (
              <><LocateFixed size={14} /> Usar mi ubicación actual</>
            )}
          </button>

          {/* Error de geolocalización */}
          {geoEstado === 'error' && geoError && (
            <div className="flex items-start gap-2 px-5 py-2 rounded-xl border border-red-200 bg-red-50 text-[11px] text-red-600 font-medium">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{geoError}</span>
            </div>
          )}

          {/* Chip de ubicación confirmada */}
          {coordenadasSeleccionadas && (
            <div className={`
              flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[11px]
              ${cargandoDireccion ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}
            `}>
              <MapPin size={13} className={`shrink-0 mt-0.5 ${cargandoDireccion ? 'text-slate-400' : 'text-blue-500'}`} />
              {cargandoDireccion ? (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Loader2 size={11} className="animate-spin" />
                  Obteniendo dirección…
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">
                    {[direccionResuelta?.estado, direccionResuelta?.municipio].filter(Boolean).join(' — ') || 'Ubicación seleccionada'}
                  </p>
                  <p className="text-slate-500 line-clamp-2 mt-0.5">{direccionResuelta?.direccion}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* ── PASO 2: Tipo de local ── */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">2</span>
              Tipo de local
            </p>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIAS.map(cat => (
                <label
                  key={cat.valor}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer
                             hover:border-blue-300 hover:bg-blue-50 transition-colors
                             has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <input
                    type="radio"
                    value={cat.valor}
                    {...register('categoria_infraestructura')}
                    className="accent-blue-600 w-3.5 h-3.5"
                  />
                  <span className="text-lg leading-none">{cat.emoji}</span>
                  <span className="text-sm font-semibold text-slate-700">{cat.etiqueta}</span>
                </label>
              ))}
            </div>
            {errors.categoria_infraestructura && (
              <p className="text-[10px] text-red-500 font-medium">{errors.categoria_infraestructura.message}</p>
            )}
          </div>

          {/* ── PASO 3: Descripción ── */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">3</span>
              Lista de necesidades
            </p>
            <textarea
              {...register('descripcion')}
              placeholder={`Qué se necesita en este lugar:\n\n- Agua potable\n- Medicamentos para hipertensión\n- Ropa de niños talla 4-8\n- Voluntarios de rescate`}
              rows={5}
              className={`w-full bg-white border rounded-xl px-3 py-2.5 text-xs text-slate-700 leading-relaxed
                          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                          transition resize-none ${errors.descripcion ? 'border-red-300' : 'border-slate-200'}`}
            />
            {errors.descripcion && (
              <p className="text-[10px] text-red-500 font-medium">{errors.descripcion.message}</p>
            )}
          </div>

          {errorEnvio && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-medium">
              {errorEnvio}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700
                         font-bold py-2.5 rounded-xl text-xs transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || !coordenadasSeleccionadas}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                         text-white font-bold py-2.5 rounded-xl text-xs transition
                         flex items-center justify-center gap-1.5"
            >
              {enviando
                ? <><Loader2 size={12} className="animate-spin" />Guardando…</>
                : <><Check size={12} />Guardar</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
