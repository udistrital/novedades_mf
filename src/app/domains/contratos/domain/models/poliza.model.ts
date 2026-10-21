/** Registro de póliza asociado a una novedad de cesión (tabla `poliza` de novedades_crud). */
export interface Poliza {
  id: string;
  numeroPoliza: string;
  entidadAseguradoraId: number | null;
}

/** Entidad aseguradora del catálogo `entidad_aseguradora` (core_amazon_crud). */
export interface Aseguradora {
  id: number;
  nombre: string;
}

/** Datos que captura la vista de registro de póliza (paso posterior a una cesión). */
export interface PolizaUpdate {
  entidadAseguradoraId: number;
  numeroPoliza: string;
}
