import { Contract, NoveltySummary } from './models/contract.entity';
import { NoveltyType, NoveltyStatus } from './models/novelty-type.enum';
import { ContractAction, ContractStatus } from './models/contract-status.enum';
import { addDaysToDate, termToDays } from '../../../shared/util/format.util';

/** Primer año con contratos en el sistema, según el catálogo de Ágora de 2026-08-30. */
const PRIMERA_VIGENCIA = 2015;

/**
 * Vigencias del año actual hacia atrás hasta la primera registrada.
 *
 * **Respaldo**, no la fuente: las vigencias reales las lista Ágora
 * (`IContractRepository.getVigencias`). Esto solo se usa mientras esa consulta
 * responde, o si falla — un desplegable de años vacío dejaría al usuario sin poder
 * buscar. Depende del reloj del equipo, así que puede errar en los extremos.
 */
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
  return contract.novelties.reduce(
    (latest, current) => (Number(current.id) >= Number(latest.id) ? current : latest),
    contract.novelties[0],
  );
}

/**
 * Suspensión que un reinicio reanuda: la última novedad del contrato, si es de
 * tipo Suspensión. Es el registro del que el reinicio toma sus fechas y el que
 * su réplica actualiza en Ágora (ver `HttpContractService.replicar`).
 */
export function activeSuspension(contract: Contract): NoveltySummary | undefined {
  const latest = getLatestNovelty(contract);
  return latest?.type === NoveltyType.SUSPENSION ? latest : undefined;
}

/**
 * Un contrato está suspendido cuando su última novedad es de tipo Suspensión.
 * (Un posterior Reinicio vuelve a dejar la última novedad en otro tipo.)
 */
export function isContractSuspended(contract: Contract): boolean {
  return !!activeSuspension(contract);
}

/**
 * Cesión cuya póliza todavía no se ha registrado, si el contrato está en esa
 * situación: es la última novedad y llegó sin número de póliza.
 *
 * Hasta que se registre, el contrato no puede recibir más novedades: la
 * garantía del cesionario es condición para seguir ejecutándolo.
 */
export function assignmentPendingPoliza(contract: Contract): NoveltySummary | undefined {
  const latest = getLatestNovelty(contract);
  return latest?.type === NoveltyType.ASSIGNMENT && !latest.numeroPoliza ? latest : undefined;
}

/**
 * Estado efectivo del contrato: el registrado en el backend si existe, y si
 * no, el inferido de las novedades (complemento necesario porque el backend de
 * pruebas no siempre tiene registros en `contrato_estado`).
 *
 * "Cesión pendiente de póliza" va **antes** que el estado del backend, y no como
 * respaldo: ese estado no existe en el catálogo `estado_contrato` y la cesión no
 * registra ningún cambio de estado (ver `NOVEDAD_BACKEND`, `estadoDestinoId: null`),
 * así que Ágora sigue reportando "En ejecución". Solo se puede derivar de la novedad.
 */
export function effectiveStatus(contract: Contract): ContractStatus {
  if (assignmentPendingPoliza(contract)) return ContractStatus.CESION_PENDIENTE_POLIZA;
  return contract.status
    ?? (isContractSuspended(contract) ? ContractStatus.SUSPENDIDO : ContractStatus.EN_EJECUCION);
}

/**
 * Etiqueta visible del estado del contrato. Coincide con el valor del enum salvo
 * en dos casos cuyo nombre de negocio en la UI es distinto: "Suscrito" se muestra
 * como "Sin acta de inicio" (aún no tiene acta registrada) y "Terminado" como
 * "Terminado (Anticipado)", que es como lo nombra el catálogo del backend
 * (`Finalizado(Anticipado)`, id 8) y como lo distingue el usuario de un
 * "Finalizado" normal.
 */
const ETIQUETAS_ESTADO: Partial<Record<ContractStatus, string>> = {
  [ContractStatus.SUSCRITO]: 'Sin acta de inicio',
  [ContractStatus.TERMINADO]: 'Terminado (Anticipado)'
};

export function contractStatusLabel(status: ContractStatus): string {
  return ETIQUETAS_ESTADO[status] ?? status;
}

/** Hay una novedad "en curso" (estado ENTR del legado) cuando la última está En trámite. */
export function hasNoveltyInProgress(contract: Contract): boolean {
  return getLatestNovelty(contract)?.status === NoveltyStatus.IN_PROCESS;
}

/**
 * Mapa estado → acciones habilitadas (requerimientos del legado):
 * En ejecución → las 4 novedades; Suspendido → Reinicio; Cesión pendiente de
 * póliza → Agregar póliza; Finalizado → Activar contrato; Cancelado / Inicio /
 * Terminado / Anulado / Liquidado → solo informativo. Una novedad "en curso"
 * bloquea todo.
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
    default: // Inicio, Cancelado, Terminado, Anulado, Liquidado: solo consulta.
      return [];
  }
}

/**
 * Condiciones estrictas de anulación (requerimientos del legado): el contrato debe tener
 * **una sola novedad**, ser esa la que se anula, y corresponder su tipo al estado
 * que produjo — anular la Suspensión de un contrato Suspendido, la Terminación de
 * un contrato Terminado, etc.
 *
 * Lo de "una sola" es literal: el requerimiento del legado habla de la *"única
 * novedad"* y negocio lo confirmó así el **2026-09-11** (hasta entonces se leía
 * como "la última"). Un contrato con dos o más novedades no
 * admite ninguna anulación, ni siquiera sobre la última.
 *
 * Ampliarlo a "la última aunque haya otras" es sustituir la condición de abajo por
 * `getLatestNovelty(contract) !== novelty`: el resto de la función ya lo soporta.
 * Lo que falta resolver antes es la reversión del estado — el mid lo devuelve
 * siempre a "En ejecución" sin mirar el historial, y con varias novedades el estado
 * correcto es el que tenía *antes* de la que se anula ([ADR-019](../../../../docs/adr/ADR-019-anulacion-solo-con-una-novedad.md)).
 */
export function canAnnulNovelty(contract: Contract, novelty: NoveltySummary): boolean {
  if (contract.novelties.length !== 1 || getLatestNovelty(contract) !== novelty) return false;
  switch (effectiveStatus(contract)) {
    case ContractStatus.SUSPENDIDO:
      return novelty.type === NoveltyType.SUSPENSION;
    case ContractStatus.CESION_PENDIENTE_POLIZA:
      return novelty.type === NoveltyType.ASSIGNMENT;
    case ContractStatus.TERMINADO:
    case ContractStatus.FINALIZADO:
      return novelty.type === NoveltyType.EARLY_TERMINATION;
    case ContractStatus.EN_EJECUCION:
      // En ejecución la última novedad puede ser una adición/prórroga, un reinicio o
      // una cesión cuya póliza ya se registró. Registrar la garantía **no** cierra la
      // cesión: un error en el cesionario se detecta a menudo después de asegurarla, y
      // dejarla sin anular obligaba a corregirlo por fuera del aplicativo.
      return [
        NoveltyType.ADDITION_EXTENSION,
        NoveltyType.EXTENSION,
        NoveltyType.RESTART,
        NoveltyType.ASSIGNMENT
      ].includes(novelty.type);
    default:
      return false;
  }
}

// --- Valor y plazo vigentes (acumulan novedades históricas) ---

/** Valor vigente del contrato: valor base + todas las adiciones históricas. */
export function currentContractValue(contract: Contract): number {
  return contract.totalValue + contract.novelties.reduce((sum, n) => sum + (n.valorAdicion ?? 0), 0);
}

/** Plazo vigente en días: plazo inicial (mes = 30 días) + todas las prórrogas históricas. */
export function currentTermDays(contract: Contract): number {
  return termToDays(contract.initialTerm) + diasProrrogaAcumulados(contract);
}

/** Días de prórroga acumulados por las novedades históricas del contrato. */
function diasProrrogaAcumulados(contract: Contract): number {
  return contract.novelties.reduce((sum, n) => sum + (n.diasProrroga ?? 0), 0);
}

/**
 * Días que las novedades históricas corren la fecha de fin del contrato: las
 * prórrogas (alargan el plazo) y las suspensiones (lo pausan, pero desplazan el
 * fin en calendario). El reinicio no suma: sus fechas se derivan de la suspensión
 * que reanuda, así que sus días ya están contados en ella.
 */
function diasQueCorrenElFin(contract: Contract): number {
  return contract.novelties.reduce((sum, n) => sum + (n.diasProrroga ?? 0) + (n.diasSuspension ?? 0), 0);
}

/**
 * Fecha de fin vigente del contrato (yyyy-mm-dd): el fin pactado en el acta de
 * inicio, corrido por las novedades posteriores.
 *
 * El acta de inicio es la fuente autoritativa del período pactado (`FechaFin`) y
 * **nunca se actualiza** —es el acta de *inicio*—, así que ni prórrogas ni
 * suspensiones se ven ahí: se suman aquí. Cuando no hay acta cargada (el listado
 * no la consulta) se cae a la aproximación por plazo, que puede desviarse unos
 * días del dato real.
 */
export function contractEndDate(contract: Contract): string {
  return contract.endDate
    ? addDaysToDate(contract.endDate, diasQueCorrenElFin(contract))
    : addDaysToDate(contract.startDate, currentTermDays(contract) + diasSuspensionAcumulados(contract));
}

/** Días de suspensión acumulados; solo afectan el calendario, no el plazo de ejecución. */
function diasSuspensionAcumulados(contract: Contract): number {
  return contract.novelties.reduce((sum, n) => sum + (n.diasSuspension ?? 0), 0);
}

/**
 * Último día válido para una terminación anticipada (yyyy-mm-dd): un día antes
 * del fin vigente del contrato. Terminar el mismo día en que el contrato ya
 * vencía no es una terminación *anticipada*, y después de esa fecha el contrato
 * ya no está en ejecución.
 */
export function maxEarlyTerminationDate(contract: Contract): string {
  return addDaysToDate(contractEndDate(contract), -1);
}

/**
 * Lo que falta por repartir en la liquidación de una terminación anticipada:
 * `valor vigente − (desembolsado + saldo del contratista + saldo de la universidad)`.
 * Cero = la liquidación cuadra; positivo = falta asignar; negativo = se pasó.
 *
 * Los tres valores reparten el contrato completo: lo ya pagado, lo ejecutado y
 * pendiente de pago, y lo no ejecutado que vuelve a la universidad. El servicio de
 * actas rechaza el documento cuando no suman ("el balance no cuadra"), así que la
 * regla se comprueba aquí antes de llegar allá.
 */
export function terminationImbalance(
  contract: Contract,
  desembolsado: number | null | undefined,
  saldoContratista: number | null | undefined,
  saldoUniversidad: number | null | undefined
): number {
  const repartido = (Number(desembolsado) || 0) + (Number(saldoContratista) || 0) + (Number(saldoUniversidad) || 0);
  return currentContractValue(contract) - repartido;
}

// --- Topes normativos (constantes sustituibles: deberían venir parametrizadas del backend) ---

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

// --- Contratista vigente tras cesión ---

/**
 * Id (en `informacion_proveedor`) del contratista vigente: el del último
 * cesionario registrado si hubo cesión, o `undefined` si el contratista
 * sigue siendo el original.
 */
export function currentContractorId(contract: Contract): string | undefined {
  const cesiones = contract.novelties.filter(n => n.type === NoveltyType.ASSIGNMENT && n.cesionarioId);
  if (!cesiones.length) return undefined;
  return cesiones.reduce((a, b) => (Number(b.id) >= Number(a.id) ? b : a), cesiones[0]).cesionarioId;
}

// --- Control de acceso por rol ---

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
