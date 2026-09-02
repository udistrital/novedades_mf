/**
 * Estados del contrato según el catálogo real `estado_contrato` de Ágora
 * (administrativa_amazon_api): Por Suscribir=1, Suspendido=2, Suscrito=3,
 * En Ejecución=4, Anulado=5, Finalizado=6, Cancelado=7,
 * Finalizado(Anticipado)=8, Liquidado=9, Novedad Anulada=10 (confirmado con
 * negocio 2026-07-22; ver `ESTADO_CONTRATO_ID` en `novelty-payload.mapper.ts`
 * para los ids). El valor de cada miembro es el nombre de negocio usado en la
 * UI; el mapper normaliza el nombre crudo del backend (con o sin tildes)
 * hacia este enum — el nombre crudo NO siempre coincide literalmente con el
 * de negocio (ver `TERMINADO`).
 *
 * `NOVEDAD ANULADA` (id 10) no tiene miembro propio: es un estado transitorio
 * que el backend atraviesa solo durante la reversión de una anulación
 * (`estado 10 → estado 4`, ver `PATCH /novedad/:id` en API_ENDPOINTS_mid.md) —
 * no se persiste como estado "actual" de un contrato en ningún flujo normal.
 */
export enum ContractStatus {
  /** Nombre crudo real del backend: "Por Suscribir" (id 1). */
  INICIO = 'Inicio',
  /** Contrato suscrito sin acta de inicio registrada aún; en la UI se muestra como "Sin acta de inicio". */
  SUSCRITO = 'Suscrito',
  EN_EJECUCION = 'En ejecución',
  SUSPENDIDO = 'Suspendido',
  CESION_PENDIENTE_POLIZA = 'Cesión pendiente de póliza',
  FINALIZADO = 'Finalizado',
  CANCELADO = 'Cancelado',
  /** El requerimiento lo llama "Fin anticipado"; el nombre crudo real del backend es "Finalizado(Anticipado)" (id 8), no "Terminado". */
  TERMINADO = 'Terminado',
  ANULADO = 'Anulado',
  LIQUIDADO = 'Liquidado'
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
