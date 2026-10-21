import { NoveltyType, NoveltyStatus } from './novelty-type.enum';
import { ContractStatus } from './contract-status.enum';

/**
 * Novedad poscontractual ya registrada sobre un contrato, en la forma
 * resumida que necesita el listado (tipo, fechas, estado y si es anulable).
 */
export interface NoveltySummary {
  id: string;
  type: NoveltyType;
  expeditionDate: string; // Fecha de expedición del acta.
  /**
   * Fecha en que la novedad realmente entra en vigor —en una suspensión, su
   * `FechaSuspension`—; puede diferir de `expeditionDate`, que es cuando se
   * expidió el acta.
   */
  effectiveDate?: string;
  /** Fecha en que termina el efecto de la novedad (`FechaFinSuspension` en una suspensión). */
  effectiveEndDate?: string;
  status: NoveltyStatus;
  /**
   * Id del acta en el gestor documental (el `enlace` de la novedad). Se guarda el
   * id, no una URL: el documento se descarga por el repositorio y se abre desde
   * memoria, así que la ruta del servicio no pertenece al dominio.
   */
  documentId?: string;
  canAnnul: boolean;
  /** Valor adicionado por esta novedad (solo adiciones); alimenta el valor vigente acumulado. */
  valorAdicion?: number;
  /** Días de prórroga de esta novedad (solo prórrogas); alimenta el plazo vigente acumulado. */
  diasProrroga?: number;
  /**
   * Días que dura esta suspensión (solo suspensiones). No alargan el plazo de
   * ejecución —lo pausan— pero sí corren la fecha de fin del contrato, que el
   * acta de inicio nunca refleja.
   */
  diasSuspension?: number;
  /** Id (en `informacion_proveedor`) del cesionario (solo cesiones); resuelve el contratista vigente tras una cesión. */
  cesionarioId?: string;
  /**
   * Fin del contrato que esta novedad dejó **registrado** (`FechaFinEfectiva`).
   * Es un valor acumulado: cada novedad lo calcula a partir del que dejó la
   * anterior, así que es la base de la siguiente y no se puede recalcular desde el
   * contrato sin desviarse (ver `fechaFinEfectiva` en `novelty-payload.mapper.ts`).
   */
  fechaFinEfectiva?: string;
  /**
   * Número de póliza de la cesión (solo cesiones). Vacío mientras no se registre:
   * es lo que deja el contrato en "Cesión pendiente de póliza". Lo devuelve el
   * propio `GET {mid}novedad/{n}/{v}` (campo `Poliza`), no hace falta consultarlo.
   */
  numeroPoliza?: string;
}

/**
 * Contrato suscrito sobre el que se tramitan novedades.
 *
 * Es la entidad raíz del dominio: agrega sus novedades históricas y aporta el
 * contexto (contratista, valores, plazos, responsables) que los formularios de
 * novedad muestran y validan.
 */
export interface Contract {
  /** Id compuesto `${numero}_${vigencia}`: el backend identifica contratos por ese par, no por un id único. */
  id: string;
  /**
   * Id principal de la fila de `contrato_general` (p. ej. "16387"), distinto del
   * número humano del contrato ("653"). Es el `NumeroContrato` que esperan
   * `contrato_estado` y los endpoints de cambio de estado.
   */
  principalId: string;
  number: string;
  contractType: string;
  contractorName: string;
  contractorId: string; // NIT / CC
  /** Id del contratista vigente en `informacion_proveedor` (campo `Contratista`); lo exigen los payloads de novedad y réplica. */
  contractorProviderId: string;
  contractingEntity: string;
  totalValue: number;
  object: string;
  initialTerm: string; // Ej. "NUEVE ( 9 ) MESES"
  /** `UnidadEjecucion.Id` del contrato (p. ej. 205 = Día(s)); la réplica lo exige tal cual. */
  executionUnitId?: number;
  /** `PlazoEjecucion` crudo del backend, en la unidad de `executionUnitId` (p. ej. 315 días). */
  executionTerm?: number;
  /**
   * Fecha de suscripción del contrato (`ContratoSuscrito.FechaSuscripcion`), que
   * no es la de inicio: se firma antes de empezar a ejecutar. La imprime el acta.
   */
  subscriptionDate?: string;
  startDate: string; // Ej. "01/01/2024" — `FechaInicio` del acta de inicio.
  /**
   * `FechaFin` del acta de inicio: fin del período **originalmente pactado**, sin
   * las prórrogas posteriores (el acta no se actualiza con ellas; por eso cada
   * novedad calcula y envía su propia fecha fin efectiva). Ausente si el contrato
   * no tiene acta o si se leyó desde el listado, que no la consulta;
   * `contractEndDate` cae entonces a la aproximación por plazo.
   */
  endDate?: string;
  supervisor: string;
  /** Documento del supervisor; la regla de rol SUPERVISOR exige que coincida con el del usuario. */
  supervisorDocument: string;
  /** Cargo del supervisor ("JEFE DE SECCIÓN BIBLIOTECA"); el acta lo imprime como su calidad. */
  supervisorRole?: string;
  spendingManager: string; // Ordenador del gasto
  /** Documento del ordenador del gasto; el acta lo exige junto al nombre. */
  spendingManagerDocument?: string;
  /**
   * Cargo del ordenador del gasto ("Director"). El acta lo imprime tres veces: en
   * "quien actúa en calidad de …", en "el … solicitó la adición" y bajo su firma.
   */
  spendingManagerRole?: string;
  /**
   * Resolución que lo designó ("RESOLUCIÓN DE RECTORÍA No. 206 (06 de junio de
   * 2023)"). El acta la cita justo después de su cargo.
   */
  spendingManagerResolution?: string;
  /**
   * `UnidadEjecutora` del contrato: 1 = Oficina de Contratación, otro = Ofex.
   * Determina qué dependencia firma el acta.
   */
  executingUnit?: number;
  /**
   * Estado real del contrato leído de `contrato_estado` (último registro).
   * `undefined` cuando el backend no tiene registros: las reglas caen al
   * comportamiento inferido (última novedad = suspensión ⇒ suspendido).
   */
  status?: ContractStatus;
  novelties: NoveltySummary[];
}
