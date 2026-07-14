/**
 * Estados del contrato según el catálogo `estado_contrato` de Ágora
 * (administrativa_amazon_api). El valor de cada miembro es el nombre de
 * negocio; el mapper normaliza el nombre crudo del backend (con o sin tildes)
 * hacia este enum.
 *
 * Ids conocidos del backend: Suspendido=2, En ejecución=4, Terminado=8
 * (ver `info/backend/endpoints_legacy.md`). Los demás ids no están
 * documentados; la lectura se hace siempre por nombre.
 */
export enum ContractStatus {
  INICIO = 'Inicio',
  /** Contrato suscrito sin acta de inicio registrada aún; en la UI se muestra como "Sin acta de inicio". */
  SUSCRITO = 'Suscrito',
  EN_EJECUCION = 'En ejecución',
  SUSPENDIDO = 'Suspendido',
  CESION_PENDIENTE_POLIZA = 'Cesión pendiente de póliza',
  FINALIZADO = 'Finalizado',
  CANCELADO = 'Cancelado',
  /** El requerimiento lo llama "Fin anticipado"; en el catálogo del backend es "Terminado" (id 8). */
  TERMINADO = 'Terminado'
}

/**
 * Acciones que el estado del contrato puede habilitar sobre él
 * (mapa estado → acciones de requerimientos §5.1).
 */
export enum ContractAction {
  ADICION_PRORROGA = 'adicion-prorroga',
  SUSPENSION = 'suspension',
  CESION = 'cesion',
  TERMINACION = 'terminacion',
  REINICIO = 'reinicio',
  AGREGAR_POLIZA = 'poliza',
  ACTIVAR_CONTRATO = 'activar'
}
