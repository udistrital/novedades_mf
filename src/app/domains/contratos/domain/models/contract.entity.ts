import { NoveltyType, NoveltyStatus } from './novelty-type.enum';

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
  spendingManager: string; // Ordenador del gasto
  novelties: NoveltySummary[];
}
