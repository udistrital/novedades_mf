/**
 * Tipos de novedad poscontractual que maneja el dominio.
 *
 * El valor de cada miembro es el rótulo que ve el usuario: el enum sirve a la
 * vez de catálogo de dominio y de etiqueta de presentación.
 */
export enum NoveltyType {
  ADDITION_EXTENSION = 'Adición y Prórroga',
  EXTENSION = 'Prórroga en Tiempo',
  ASSIGNMENT = 'Cesión',
  SUSPENSION = 'Suspensión',
  RESTART = 'Reinicio',
  EARLY_TERMINATION = 'Terminación Anticipada'
}

/** Estado del trámite de una novedad; "En trámite" bloquea nuevas novedades sobre el contrato. */
export enum NoveltyStatus {
  IN_EXECUTION = 'En ejecución',
  FINISHED = 'Terminada',
  IN_PROCESS = 'En trámite'
}
