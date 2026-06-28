// Definimos los tipos permitidos para los lugares afectados
export type CategoriaInfraestructura = 
  | 'Estructura_caida' 
  | 'Peligro Estructural' 
  | 'Centro Médico' 
  | 'Refugio' 
  | 'Centro Veterinario';

// Definimos los tipos de recursos o necesidades específicas
export type TipoNecesidad = 
  | 'Agua' 
  | 'Comida' 
  | 'Ropa' 
  | 'Medicamentos' 
  | 'Equipo de Rescate' 
  | 'Equipo Médico'
  | 'Equipo Veterinario'
  | 'Maquinaria de Rescate'
  | 'Objetos para Rescate'
  | 'Múltiples Necesidades'

// Estructura idéntica a nuestra tabla de Supabase actualizada
export interface Reporte {
  id: string;
  latitud: number;
  longitud: number;
  direccion_texto: string;
  estado?: string;
  municipio?: string;
  categoria_infraestructura: CategoriaInfraestructura;
  tipo_necesidad: TipoNecesidad;
  descripcion?: string;
  contacto?: string;
  creado_en: string;
}
