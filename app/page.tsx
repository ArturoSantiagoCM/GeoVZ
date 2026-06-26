'use client' 

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Reporte } from '@/types'
import dynamic from 'next/dynamic' // ← 1. Importamos la herramienta dinámica de Next.js

// 2. Cargamos el mapa desactivando el SSR (Server-Side Rendering) para evitar el error de "window"
const Mapa = dynamic(() => import('@/components/Mapa'), {
  ssr: false,  
  loading: () => (
    <div className="flex h-[70vh] w-full items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
      <p className="text-sm font-medium text-slate-400 animate-pulse">
        Preparando mapa interactivo...
      </p>
    </div>
  )
})

export default function Page() {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [cargando, setCargando] = useState(true)

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

    const channel = supabase
      .channel('reportes-nuevos')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'reportes' }, 
        (payload) => {
          setReportes((prev) => [payload.new as Reporte, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (cargando) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          Conectando con la red de emergencias de Venezuela...
        </p>
      </div>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
      <div className="w-full max-w-5xl mb-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Mapa de Necesidades y Afectaciones — Crisis
        </h1>
        <p className="text-sm text-slate-600">
          Reportes ciudadanos en tiempo real sobre el estado de infraestructuras y recursos faltantes.
        </p>
      </div>

      <div className="w-full max-w-5xl overflow-hidden rounded-xl shadow-lg border border-slate-200 bg-white p-2">
        <Mapa reportes={reportes} />
      </div>
    </main>
  )
}