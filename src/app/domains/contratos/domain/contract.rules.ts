import { Contract, NoveltySummary } from './models/contract.entity';
import { NoveltyType, NoveltyStatus } from './models/novelty-type.enum';
import { ContractAction, ContractStatus } from './models/contract-status.enum';
import { termToDays } from '../../../shared/util/format.util';

/** Primer año con contratos en el sistema. */
const PRIMERA_VIGENCIA = 2015;

/** Vigencias seleccionables, del año actual hacia atrás hasta la primera registrada. */
export function availableVigencias(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - PRIMERA_VIGENCIA + 1 }, (_, i) => String(current - i));
}

/**
 * Última novedad del contrato según su `id` (autoincremental en el backend).
 * No se usa `expeditionDate`: varias novedades del mismo día empatan en esa
 * fecha y el desempate por orden de iteración terminaba eligiendo la más
 * antigua en vez de la más reciente.
 */
export function getLatestNovelty(contract: Contract): NoveltySummary | undefined {
  if (!contract.novelties.length) return undefined;
  return contract.novelties.reduce((latest, current) =>
    Number(current.id) >= Number(latest.id) ? current : latest
  );
}

/**
 * Un contrato está suspendido cuando su última novedad es de tipo Suspensión.
 * (Un posterior Reinicio vuelve a dejar la última novedad en otro tipo.)
 */
export function isContractSuspended(contract: Contract): boolean {
  return getLatestNovelty(contract)?.type === NoveltyType.SUSPENSION;
}

/**
 * Estado efectivo del contrato: el registrado en el backend si existe, y si
 * no, el inferido de las novedades (complemento documentado en MIG-002: el
 * backend de pruebas no siempre tiene registros en `contrato_estado`).
 */
export function effectiveStatus(contract: Contract): ContractStatus {
  return contract.status
    ?? (isContractSuspended(contract) ? ContractStatus.SUSPENDIDO : ContractStatus.EN_EJECUCION);
}

/**
 * Etiqueta visible del estado del contrato: coincide con el valor del enum
 * salvo "Suscrito", cuyo nombre de negocio en la UI es "Sin acta de inicio"
 * (el contrato aún no tiene acta de inicio registrada).
 */
export function contractStatusLabel(status: ContractStatus): string {
  return status === ContractStatus.SUSCRITO ? 'Sin acta de inicio' : status;
}

/** Hay una novedad "en curso" (estado ENTR del legado) cuando la última está En trámite. */
export function hasNoveltyInProgress(contract: Contract): boolean {
  return getLatestNovelty(contract)?.status === NoveltyStatus.IN_PROCESS;
}

/**
 * Mapa estado → acciones habilitadas (requerimientos §5.1):
 * En ejecución → las 4 novedades; Suspendido → Reinicio; Cesión pendiente de
 * póliza → Agregar póliza; Finalizado → Activar contrato; Cancelado / Inicio /
 * Terminado → solo informativo. Una novedad "en curso" bloquea todo (§5.1).
 */
export function availableActions(contract: Contract): ContractAction[] {
  if (hasNoveltyInProgress(contract)) return [];
  switch (effectiveStatus(contract)) {
    case ContractStatus.EN_EJECUCION:
      return [
        ContractAction.ADICION_PRORROGA,
        ContractAction.SUSPENSION,
        ContractAction.CESION,
        ContractAction.TERMINACION
      ];
    case ContractStatus.SUSPENDIDO:
      return [ContractAction.REINICIO];
    case ContractStatus.CESION_PENDIENTE_POLIZA:
      return [ContractAction.AGREGAR_POLIZA];
    case ContractStatus.FINALIZADO:
      return [ContractAction.ACTIVAR_CONTRATO];
    default: // Inicio, Cancelado, Terminado: solo consulta.
      return [];
  }
}

/**
 * Condiciones estrictas de anulación (requerimientos §5.1): solo la última
 * novedad, y solo cuando su tipo corresponde al estado que produjo — anular
 * la Suspensión de un contrato Suspendido, la Cesión pendiente de póliza, etc.
 * (Interpretación #1 documentada en MIGRATION_PLAN: "coincide con el botón
 * habilitado" = la novedad que produjo el estado actual.)
 */
export function canAnnulNovelty(contract: Contract, novelty: NoveltySummary): boolean {
  if (getLatestNovelty(contract) !== novelty) return false;
  switch (effectiveStatus(contract)) {
    case ContractStatus.SUSPENDIDO:
      return novelty.type === NoveltyType.SUSPENSION;
    case ContractStatus.CESION_PENDIENTE_POLIZA:
      return novelty.type === NoveltyType.ASSIGNMENT;
    case ContractStatus.TERMINADO:
    case ContractStatus.FINALIZADO:
      return novelty.type === NoveltyType.EARLY_TERMINATION;
    case ContractStatus.EN_EJECUCION:
      // En ejecución la última novedad puede ser una adición/prórroga o un reinicio.
      return [NoveltyType.ADDITION_EXTENSION, NoveltyType.EXTENSION, NoveltyType.RESTART, NoveltyType.ASSIGNMENT]
        .includes(novelty.type);
    default:
      return false;
  }
}

// --- Valor y plazo vigentes (acumulan novedades históricas, requerimientos §5.1/§5.2) ---

/** Valor vigente del contrato: valor base + todas las adiciones históricas. */
export function currentContractValue(contract: Contract): number {
  return contract.totalValue + contract.novelties.reduce((sum, n) => sum + (n.valorAdicion ?? 0), 0);
}

/** Plazo vigente en días: plazo inicial (mes = 30 días) + todas las prórrogas históricas. */
export function currentTermDays(contract: Contract): number {
  return termToDays(contract.initialTerm) + contract.novelties.reduce((sum, n) => sum + (n.diasProrroga ?? 0), 0);
}

// --- Topes normativos (requerimientos §5.2; TD-006: parametrizar en backend a futuro) ---

/** Tope legal de adición: 50 % del valor vigente del contrato. */
export const TOPE_ADICION = 0.5;
/** Tope legal de prórroga: 50 % del plazo vigente en días. */
export const TOPE_PRORROGA = 0.5;

/** Valor máximo permitido para una nueva adición. */
export function maxAdditionValue(contract: Contract): number {
  return currentContractValue(contract) * TOPE_ADICION;
}

/** Días máximos permitidos para una nueva prórroga. */
export function maxExtensionDays(contract: Contract): number {
  return Math.floor(currentTermDays(contract) * TOPE_PRORROGA);
}

// --- Contratista vigente tras cesión (requerimientos §5.5) ---

/**
 * Id (en `informacion_proveedor`) del contratista vigente: el del último
 * cesionario registrado si hubo cesión, o `undefined` si el contratista
 * sigue siendo el original.
 */
export function currentContractorId(contract: Contract): string | undefined {
  const cesiones = contract.novelties.filter(n => n.type === NoveltyType.ASSIGNMENT && n.cesionarioId);
  if (!cesiones.length) return undefined;
  return cesiones.reduce((a, b) => (Number(b.id) >= Number(a.id) ? b : a)).cesionarioId;
}

// --- Control de acceso por rol (requerimientos §4) ---

export const ROL_SUPERVISOR = 'SUPERVISOR';

/**
 * Regla de autorización del legado: si el rol del usuario es SUPERVISOR, su
 * documento debe coincidir con el del supervisor del contrato; si no coincide,
 * solo consulta. Usuarios con algún otro rol autorizado (ordenador, asistente
 * jurídica) no están sujetos a la coincidencia de documento.
 * (Interpretación documentada: sin selector de "rol activo" en el shell, se
 * aplica la restricción solo a usuarios cuyo único rol de negocio es SUPERVISOR.)
 */
export function canManageContract(userRoles: string[], userDocument: string, contract: Contract): boolean {
  const roles = userRoles.map(r => r.toUpperCase());
  const esSoloSupervisor = roles.includes(ROL_SUPERVISOR) &&
    !roles.some(r => r.includes('ORDENADOR') || r.includes('JURIDICA') || r.includes('JURÍDICA'));
  if (!esSoloSupervisor) return true;
  return !!userDocument && userDocument === contract.supervisorDocument;
}
