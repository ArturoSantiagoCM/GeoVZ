'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { supabase } from '@/lib/supabase'
import { TipoNecesidad, CategoriaInfraestructura } from '@/types'
import { MapPin, AlertTriangle, Check, Loader2, X, Search } from 'lucide-react'

// Esquema de validación con Zod
const schemaReporte = z.object({
  tipo_necesidad: z.string().min(1, { message: 'Selecciona una necesidad' }),
  categoria_infraestructura: z.string().min(1, { message: 'Selecciona una infraestructura afectada' }),
  descripcion: z.string().max(300, { message: 'Máximo 300 caracteres' }).optional(),
  contacto: z.string().max(100, { message: 'Máximo 100 caracteres' }).optional()
})

type FormInputs = z.infer<typeof schemaReporte>

interface FormularioReporteProps {
  coordenadasSeleccionadas: { lat: number; lng: number } | null
  setCoordenadasSeleccionadas: (coords: { lat: number; lng: number } | null) => void
  onSuccess: () => void
  onCancel: () => void
}

const tiposNecesidades: TipoNecesidad[] = [
  'Agua',
  'Comida',
  'Ropa',
  'Medicamentos',
  'Equipo de Rescate',
  'Equipo Médico',
  'Equipo Veterinario',
  'Maquinaria de Rescate',
  'Objetos para Rescate'
]

const categoriasInfraestructura: CategoriaInfraestructura[] = [
  'Estructura_caida',
  'Peligro Estructural',
  'Centro Médico',
  'Refugio',
  'Centro Veterinario'
]

export default function FormularioReporte({
  coordenadasSeleccionadas,
  setCoordenadasSeleccionadas,
  onSuccess,
  onCancel
}: FormularioReporteProps) {
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  
  // Estados para búsqueda de dirección (Geocoding directo)
  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [buscandoDireccion, setBuscandoDireccion] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)

  // Estados para dirección resuelta (Geocoding inverso)
  const [cargandoDireccion, setCargandoDireccion] = useState(false)
  const [direccionResuelta, setDireccionResuelta] = useState<{
    direccion: string
    estado: string
    municipio: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormInputs>({
    resolver: zodResolver(schemaReporte)
  })

  // Geocodificación inversa cuando cambian las coordenadas seleccionadas (por click o por búsqueda)
  useEffect(() => {
    if (!coordenadasSeleccionadas) {
      setDireccionResuelta(null)
      return
    }

    const geocodificar = async () => {
      setCargandoDireccion(true)
      try {
        const { lat, lng } = coordenadasSeleccionadas
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'es'
            }
          }
        )
        const data = await res.json()
        
        if (data && data.address) {
          const addressInfo = data.address
          const estado = addressInfo.state || addressInfo.region || ''
          const municipio = addressInfo.county || addressInfo.city || addressInfo.town || addressInfo.municipality || ''
          const direccion = data.display_name || 'Ubicación seleccionada'
          
          setDireccionResuelta({
            direccion,
            estado,
            municipio
          })
        } else {
          setDireccionResuelta({
            direccion: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
            estado: '',
            municipio: ''
          })
        }
      } catch (err) {
        console.error('Error al geocodificar:', err)
        setDireccionResuelta({
          direccion: `Lat: ${coordenadasSeleccionadas.lat.toFixed(5)}, Lng: ${coordenadasSeleccionadas.lng.toFixed(5)}`,
          estado: '',
          municipio: ''
        })
      } finally {
        setCargandoDireccion(false)
      }
    }

    geocodificar()
  }, [coordenadasSeleccionadas])

  // Geocodificación Directa (Dirección de texto -> Coordenadas)
  const manejarBusquedaDireccion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!textoBusqueda.trim()) return

    setBuscandoDireccion(true)
    setErrorBusqueda(null)

    try {
      // Limitamos los resultados a Venezuela (countrycodes=ve) para evitar errores
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          textoBusqueda
        )}&format=json&addressdetails=1&limit=1&countrycodes=ve`,
        {
          headers: {
            'Accept-Language': 'es'
          }
        }
      )
      const data = await res.json()

      if (data && data.length > 0) {
        const resultado = data[0]
        const lat = parseFloat(resultado.lat)
        const lng = parseFloat(resultado.lon)

        // Actualizamos las coordenadas seleccionadas en el estado del componente padre (centra el mapa automáticamente)
        setCoordenadasSeleccionadas({ lat, lng })
      } else {
        setErrorBusqueda('No se encontró la dirección en Venezuela. Intenta con nombres más sencillos (ej: "Chacao, Caracas" o "Maracay").')
      }
    } catch (err) {
      console.error('Error en geocoding directo:', err)
      setErrorBusqueda('Error de conexión al buscar la dirección. Por favor, inténtalo de nuevo.')
    } finally {
      setBuscandoDireccion(false)
    }
  }

  const onSubmit = async (data: FormInputs) => {
    if (!coordenadasSeleccionadas) {
      setErrorEnvio('Por favor, busca una dirección o selecciona una ubicación en el mapa.')
      return
    }

    setEnviando(true)
    setErrorEnvio(null)

    try {
      const { error } = await supabase.from('reportes').insert({
        latitud: coordenadasSeleccionadas.lat,
        longitud: coordenadasSeleccionadas.lng,
        tipo_necesidad: data.tipo_necesidad as TipoNecesidad,
        categoria_infraestructura: data.categoria_infraestructura as CategoriaInfraestructura,
        descripcion: data.descripcion || null,
        contacto: data.contacto || null,
        direccion_texto: direccionResuelta?.direccion || 'Ubicación seleccionada',
        estado: direccionResuelta?.estado || null,
        municipio: direccionResuelta?.municipio || null,
        atendido: false,
        verificado: false
      })

      if (error) throw error

      reset()
      setTextoBusqueda('')
      onSuccess()
    } catch (err: any) {
      console.error('Error al enviar reporte:', err)
      setErrorEnvio(err.message || 'Ocurrió un error al enviar el reporte. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-md space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          Registrar Nueva Necesidad
        </h2>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Buscador de Dirección por Texto (Geocoding) */}
      <form onSubmit={manejarBusquedaDireccion} className="space-y-1">
        <label className="text-xs font-bold text-slate-600 block">Buscar Dirección en Venezuela</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={textoBusqueda}
              onChange={(e) => setTextoBusqueda(e.target.value)}
              placeholder="Ej: Altamira, Caracas o Valencia, Carabobo..."
              className="w-full pr-4 pl-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition"
            />
          </div>
          <button
            type="submit"
            disabled={buscandoDireccion || !textoBusqueda.trim()}
            className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white px-3.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
          >
            {buscandoDireccion ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Search size={12} />
            )}
            Buscar
          </button>
        </div>
        {errorBusqueda && (
          <span className="text-[10px] text-red-500 font-medium block pt-0.5">
            {errorBusqueda}
          </span>
        )}
      </form>

      <div className="h-px bg-slate-100 my-2" />

      {/* Indicador de coordenadas y ubicación */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 space-y-2">
        <div className="flex items-start gap-2.5">
          <MapPin className="text-blue-500 shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-700 block">Ubicación Seleccionada</span>
            {coordenadasSeleccionadas ? (
              cargandoDireccion ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Geocodificando coordenadas...</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-600 leading-normal">
                  <span className="font-semibold text-slate-800">
                    {direccionResuelta?.estado
                      ? `${direccionResuelta.estado} - ${direccionResuelta.municipio}`
                      : 'Ubicación seleccionada'}
                  </span>
                  <p className="text-slate-500 line-clamp-2 mt-0.5">{direccionResuelta?.direccion}</p>
                </div>
              )
            ) : (
              <span className="text-xs text-amber-600 font-medium animate-pulse block">
                ⚠️ Busca la dirección arriba o haz clic directamente en el mapa
              </span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        {/* Tipo de necesidad */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block">Tipo de Necesidad</label>
          <select
            {...register('tipo_necesidad')}
            className={`w-full bg-white border rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition ${
              errors.tipo_necesidad ? 'border-red-500' : 'border-slate-200'
            }`}
          >
            <option value="">-- Selecciona --</option>
            {tiposNecesidades.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
          {errors.tipo_necesidad && (
            <span className="text-[10px] text-red-500 font-medium block">
              {errors.tipo_necesidad.message}
            </span>
          )}
        </div>

        {/* Categoria infraestructura */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block">Infraestructura Afectada</label>
          <select
            {...register('categoria_infraestructura')}
            className={`w-full bg-white border rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition ${
              errors.categoria_infraestructura ? 'border-red-500' : 'border-slate-200'
            }`}
          >
            <option value="">-- Selecciona --</option>
            {categoriasInfraestructura.map((infra) => (
              <option key={infra} value={infra}>
                {infra.replace('_', ' ')}
              </option>
            ))}
          </select>
          {errors.categoria_infraestructura && (
            <span className="text-[10px] text-red-500 font-medium block">
              {errors.categoria_infraestructura.message}
            </span>
          )}
        </div>

        {/* Descripcion */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block">
            Descripción de la Situación <span className="text-slate-400 font-normal">(Opcional)</span>
          </label>
          <textarea
            {...register('descripcion')}
            placeholder="Describe brevemente qué recursos faltan, cuántas personas están afectadas, etc."
            rows={3}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
          />
        </div>

        {/* Contacto */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-600 block">
            Información de Contacto <span className="text-slate-400 font-normal">(Opcional)</span>
          </label>
          <input
            {...register('contacto')}
            type="text"
            placeholder="Ej: Juan Pérez / +58 412..."
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
        </div>

        {errorEnvio && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600 font-medium">
            {errorEnvio}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-1/2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-lg text-xs transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !coordenadasSeleccionadas}
            className="w-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
          >
            {enviando ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check size={12} />
                Guardar Reporte
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
