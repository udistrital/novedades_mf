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
  /** Fecha en que la novedad realmente entra en vigor (p. ej. inicio real de una suspensión); puede diferir de `expeditionDate`. */
  effectiveDate?: string;
  status: NoveltyStatus;
  documentUrl?: string;
  canAnnul: boolean;
  /** Valor adicionado por esta novedad (solo adiciones); alimenta el valor vigente acumulado. */
  valorAdicion?: number;
  /** Días de prórroga de esta novedad (solo prórrogas); alimenta el plazo vigente acumulado. */
  diasProrroga?: number;
  /** Id (en `informacion_proveedor`) del cesionario (solo cesiones); resuelve el contratista vigente tras una cesión. */
  cesionarioId?: string;
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
  number: string;
  contractType: string;
  contractorName: string;
  contractorId: string; // NIT / CC
  contractingEntity: string;
  totalValue: number;
  object: string;
  initialTerm: string; // Ej. "NUEVE ( 9 ) MESES"
  startDate: string; // Ej. "01/01/2024"
  supervisor: string;
  /** Documento del supervisor; la regla de rol SUPERVISOR exige que coincida con el del usuario. */
  supervisorDocument: string;
  spendingManager: string; // Ordenador del gasto
  /**
   * Estado real del contrato leído de `contrato_estado` (último registro).
   * `undefined` cuando el backend no tiene registros: las reglas caen al
   * comportamiento inferido (última novedad = suspensión ⇒ suspendido).
   */
  status?: ContractStatus;
  novelties: NoveltySummary[];
}
