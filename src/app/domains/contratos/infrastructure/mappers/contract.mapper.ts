import { Contract, NoveltySummary } from '../../domain/models/contract.entity';
import { NoveltyStatus, NoveltyType } from '../../domain/models/novelty-type.enum';
import { ContractStatus } from '../../domain/models/contract-status.enum';
import { Assignee } from '../../domain/models/assignee.model';
import { Aseguradora, Poliza } from '../../domain/models/poliza.model';
import { canAnnulNovelty } from '../../domain/contract.rules';
import { DIAS_POR_MES, formatTerm, toDisplayDate } from '../../../../shared/util/format.util';
import {
  ContratoEstadoDto,
  ContratoGeneralDto,
  EntidadAseguradoraDto,
  InformacionProveedorDto,
  NovedadMidDto,
  PolizaDto
} from '../dtos/external-api.dto';

/** Códigos de TipoNovedad de novedades_mid (ver backend/API_ENDPOINTS_mid.md). */
const TIPO_NOVEDAD: Record<number, NoveltyType> = {
  1: NoveltyType.SUSPENSION,
  2: NoveltyType.ASSIGNMENT,
  3: NoveltyType.RESTART,
  5: NoveltyType.EARLY_TERMINATION,
  6: NoveltyType.ADDITION_EXTENSION, // adición sola: el dominio no la separa de adición+prórroga
  7: NoveltyType.EXTENSION,
  8: NoveltyType.ADDITION_EXTENSION
};

function toStatus(estado: string | undefined): NoveltyStatus {
  const e = (estado ?? '').toUpperCase();
  if (e.includes('TERMINADA')) return NoveltyStatus.FINISHED;
  // ENTR es el código del legado para "en trámite/en curso" (bloquea nuevas novedades).
  if (e.includes('TRAMITE') || e.includes('TRÁMITE') || e.includes('ENTR')) return NoveltyStatus.IN_PROCESS;
  return NoveltyStatus.IN_EXECUTION;
}

/** Normaliza sin tildes/mayúsculas para comparar nombres de estado del backend. */
function normalizado(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

// Orden importa: `.find()` toma el primer match y "Finalizado(Anticipado)" contiene
// "FINALIZADO" — por eso 'ANTICIPADO' va ANTES de 'FINALIZADO', si no toda terminación
// anticipada se leería como un Finalizado normal (habilitaría "Activar contrato" cuando
// no debería). Claves = nombre crudo real del catálogo `estado_contrato` (confirmado
// 2026-07-22), no el nombre de negocio del enum.
const ESTADOS_CONTRATO: readonly [string, ContractStatus][] = [
  ['ANTICIPADO', ContractStatus.TERMINADO], // "Finalizado(Anticipado)", id 8.
  ['SUSCRITO', ContractStatus.SUSCRITO],
  ['EN EJECUCION', ContractStatus.EN_EJECUCION],
  ['SUSPENDIDO', ContractStatus.SUSPENDIDO],
  ['CESION', ContractStatus.CESION_PENDIENTE_POLIZA], // "Cesión pendiente de póliza" o variantes.
  ['FINALIZADO', ContractStatus.FINALIZADO],
  ['CANCELADO', ContractStatus.CANCELADO],
  ['ANULADO', ContractStatus.ANULADO],
  ['LIQUIDADO', ContractStatus.LIQUIDADO],
  ['POR SUSCRIBIR', ContractStatus.INICIO]
];

/**
 * Estado del contrato a partir del último registro de `contrato_estado`.
 * La comparación es por nombre (sin tildes): los ids del catálogo no están
 * documentados completos. Devuelve `undefined` si no hay registro o el nombre
 * no se reconoce (las reglas de dominio caen entonces a la inferencia).
 */
export function toContractStatus(rows: ContratoEstadoDto[] | null | undefined): ContractStatus | undefined {
  const row = rows?.[0];
  if (!row) return undefined;
  const nombre =
    row.NombreEstado ??
    (typeof row.Estado === 'object' ? row.Estado?.NombreEstado : typeof row.Estado === 'string' ? row.Estado : '');
  if (!nombre) return undefined;
  const n = normalizado(String(nombre));
  return ESTADOS_CONTRATO.find(([clave]) => n.includes(clave))?.[1];
}

/** Normaliza fechas del backend (ISO `yyyy-mm-dd...` o ya `dd/mm/yyyy`) a dd/mm/yyyy. */
export function toDdMmYyyy(value: string | null | undefined): string {
  if (!value) return '';
  return value.includes('/') ? value.split(' ')[0] : toDisplayDate(value.slice(0, 10));
}

/**
 * Lee un valor que puede llegar como string plano o como objeto con el nombre en
 * `Nombre`, `TipoContrato` o `Descripcion` (p. ej. `UnidadEjecucion` usa
 * `Descripcion: "Dia(s)"`, y sin leerla el plazo se interpretaría en meses).
 * Devuelve '' cuando el backend manda solo un id numérico (`OrdenadorGasto`).
 */
function readNombre(
  value: { Nombre?: string; TipoContrato?: string; Descripcion?: string } | string | number | undefined
): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return '';
  return value.Nombre ?? value.TipoContrato ?? value.Descripcion ?? '';
}

/**
 * Plazo del contrato en el formato único del negocio: "DIEZ ( 10 ) MESES Y
 * QUINCE ( 15 ) DÍAS".
 *
 * Ágora lo guarda en la unidad con que se pactó el contrato (`PlazoEjecucion` +
 * `UnidadEjecucion`), así que aquí se pasa a días con la regla mes = 30 días y se
 * formatea una sola vez. Es el punto donde nace el plazo que ven la tarjeta del
 * contrato, los resúmenes y las actas: normalizarlo aquí evita convertirlo en cada
 * vista. El número crudo sigue disponible en `executionTerm`.
 */
function toInitialTerm(plazo: number | string | undefined, unidad: string): string {
  const n = Number(plazo);
  if (!plazo || Number.isNaN(n) || n <= 0) return String(plazo ?? '');
  return formatTerm(n * (esUnidadEnDias(unidad) ? 1 : DIAS_POR_MES));
}

/** `UnidadEjecucion.Descripcion` viene como "Dia(s)" / "Mes(es)"; sin dato se asumen meses. */
function esUnidadEnDias(unidad: string): boolean {
  return normalizado(unidad).startsWith('DIA');
}


/**
 * Lee el primer campo presente entre varios nombres candidatos.
 *
 * Los nombres quedaron **fijados el 2026-08-29** contra `novedades_mid/models/*.go`:
 * las cinco funciones `GetNovedad*` arman exactamente el mismo mapa de respuesta
 * (`ValorAdicion`, `TiempoProrroga`, `PeriodoSuspension`, `Cesionario`, `Poliza`,
 * `FechaExpedicion`, `FechaSuspension`, `FechaFinSuspension`, `NombreEstado`,
 * `Estado`, `Enlace`…), así que se borraron los candidatos inventados que quedaban
 * de cuando el esquema no estaba confirmado.
 *
 * Sobreviven solo dos alternativas, y por una razón concreta: cuando la respuesta
 * llega **anidada** (`{NovedadPoscontractual:{…}}`) el objeto interno es la fila
 * cruda del CRUD, que nombra distinto esos dos campos (`FechaCreacion` en vez de
 * `FechaExpedicion` y `EnlaceDocumento` en vez de `Enlace`).
 */
function readCandidate(raw: NovedadMidDto, keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key];
  }
  return undefined;
}

function toNoveltySummary(item: NovedadMidDto): NoveltySummary {
  const raw = item.NovedadPoscontractual ?? item;
  const type = TIPO_NOVEDAD[Number(raw.TipoNovedad)] ?? NoveltyType.ADDITION_EXTENSION;
  // Todos los campos de negocio se leen del objeto ya desanidado (`raw`), igual que
  // tipo/estado/fecha: cuando el mid responde con la forma anidada ({NovedadPoscontractual:{…}})
  // estos datos viven dentro, no en el envoltorio — leerlos de `item` los perdía y, sin
  // `cesionarioId`, la tarjeta seguía mostrando el contratista original tras una cesión.
  const valorAdicion = Number(readCandidate(raw, ['ValorAdicion']));
  // Los días se leen según el tipo: los candidatos genéricos (`Dias`) son comunes a
  // prórroga y suspensión, y sin discriminar una suspensión inflaría el plazo vigente.
  const esProrroga = type === NoveltyType.EXTENSION || type === NoveltyType.ADDITION_EXTENSION;
  const diasProrroga = esProrroga ? Number(readCandidate(raw, ['TiempoProrroga'])) : NaN;
  const diasSuspension = type === NoveltyType.SUSPENSION ? Number(readCandidate(raw, ['PeriodoSuspension'])) : NaN;
  const cesionarioId = readCandidate(raw, ['Cesionario']);
  // El mid resuelve la póliza de la cesión y la devuelve en `Poliza` (es el
  // `NumeroPolizaId` del CRUD): con eso basta para saber si el trámite quedó a medias.
  const numeroPoliza = type === NoveltyType.ASSIGNMENT ? readCandidate(raw, ['Poliza']) : undefined;
  const finEfectivo = readCandidate(raw, ['FechaFinEfectiva']);
  const enlace = readCandidate(raw, ['Enlace', 'EnlaceDocumento']);
  const fechaExpedicion = readCandidate(raw, ['FechaExpedicion', 'FechaCreacion']);
  // Período real de la suspensión, distinto de la expedición del acta: el formulario
  // de Reinicio lo precarga para no obligar a redigitar lo que ya está registrado.
  const fechaSuspension = readCandidate(raw, ['FechaSuspension']);
  const fechaFinSuspension = readCandidate(raw, ['FechaFinSuspension']);
  // Las dos existen: `NombreEstado` es el nombre legible y `Estado` el código
  // abreviado (ENEJ/TERM), que sirve de respaldo si el mid no resolvió el nombre.
  const nombreEstado = readCandidate(raw, ['NombreEstado', 'Estado']);
  return {
    id: String(raw.Id ?? ''),
    type,
    expeditionDate: toDdMmYyyy(String(fechaExpedicion ?? '')),
    effectiveDate: toDdMmYyyy(String(fechaSuspension ?? '')) || undefined,
    effectiveEndDate: toDdMmYyyy(String(fechaFinSuspension ?? '')) || undefined,
    status: toStatus(String(nombreEstado ?? '')),
    // El `enlace` de la novedad es el id del acta en el gestor documental; el
    // contenido se descarga aparte (ver `getNoveltyDocument`).
    documentId: enlace ? String(enlace) : undefined,
    // El mid no devuelve `Activo`: filtra por `activo:true` en el CRUD, así que todo
    // lo que llega está activo. Se conserva la lectura como red por si eso cambia.
    canAnnul: raw.Activo !== false,
    valorAdicion: Number.isFinite(valorAdicion) && valorAdicion > 0 ? valorAdicion : undefined,
    diasProrroga: Number.isFinite(diasProrroga) && diasProrroga > 0 ? diasProrroga : undefined,
    diasSuspension: Number.isFinite(diasSuspension) && diasSuspension > 0 ? diasSuspension : undefined,
    cesionarioId: cesionarioId !== undefined ? String(cesionarioId) : undefined,
    numeroPoliza: numeroPoliza !== undefined ? String(numeroPoliza) : undefined,
    fechaFinEfectiva: toDdMmYyyy(String(finEfectivo ?? '')) || undefined
  };
}

/**
 * Convierte las novedades del mid; la anulabilidad definitiva se resuelve en `toContract`.
 *
 * No hace falta descartar las novedades desactivadas por la compensación: el mid ya
 * consulta el CRUD con `activo:true` (`GET /v1/novedad/:id/:vigencia`, ver
 * `info/backend/API_ENDPOINTS_mid.md`), así que una novedad cuya réplica falló no llega
 * hasta aquí. Filtrarlo otra vez en el cliente sería código inalcanzable.
 */
export function toNoveltySummaries(items: NovedadMidDto[]): NoveltySummary[] {
  // El mid las devuelve en orden de inserción (más antigua primero); la UI quiere la más
  // reciente arriba. `Id` es autoincremental, así que ordenar por él descendente basta.
  return [...items]
    .sort((a, b) => Number(b.Id ?? 0) - Number(a.Id ?? 0))
    .map(toNoveltySummary);
}

/**
 * Convierte una fila cruda de `contrato_general` (más su proveedor y novedades
 * ya resueltos) en la entidad de dominio `Contract`.
 *
 * Concentra la tolerancia al esquema laxo del backend legado: campos con
 * nombres alternativos, valores como string u objeto, y datos ausentes.
 */
export function toContract(
  row: ContratoGeneralDto,
  proveedor: InformacionProveedorDto | null,
  novelties: NoveltySummary[],
  status?: ContractStatus
): Contract {
  const suscrito = row.ContratoSuscrito?.[0];
  const numero = String(suscrito?.NumeroContratoSuscrito ?? row.NumeroContrato ?? '');
  const vigencia = String(row.VigenciaContrato ?? row.Vigencia ?? suscrito?.Vigencia ?? '');
  const supervisor = typeof row.Supervisor === 'object' ? row.Supervisor : undefined;
  const unidadEjecucion = typeof row.UnidadEjecucion === 'object' ? row.UnidadEjecucion : undefined;
  const contratistaId = typeof row.Contratista === 'object' ? row.Contratista?.Id : row.Contratista;
  const contract: Contract = {
    // Id compuesto: el backend identifica contratos por número + vigencia, no por un id único.
    id: `${numero}_${vigencia}`,
    principalId: String(row.Id ?? ''),
    number: numero,
    contractType: readNombre(row.TipoContrato),
    contractorName: proveedor?.NomProveedor ?? '',
    contractorId: String(proveedor?.NumDocumento ?? ''),
    contractorProviderId: String(contratistaId ?? ''),
    contractingEntity: 'Universidad Distrital Francisco José de Caldas',
    totalValue: Number(row.ValorContrato ?? row.Valor) || 0,
    object: String(row.ObjetoContrato ?? row.Objeto ?? ''),
    initialTerm: toInitialTerm(row.PlazoEjecucion, readNombre(row.UnidadEjecucion) || 'MESES'),
    executionUnitId: unidadEjecucion?.Id,
    executionTerm: Number(row.PlazoEjecucion) || undefined,
    subscriptionDate: toDdMmYyyy(suscrito?.FechaSuscripcion ?? row.FechaRegistro) || undefined,
    // ponytail: fecha de registro como inicio; la fecha real de inicio vive en
    // acta_inicio (vía contrato_suscrito) — encadenar cuando se conecten las actas.
    startDate: toDdMmYyyy(row.FechaRegistro) || `01/01/${vigencia}`,
    executingUnit: Number(row.UnidadEjecutora) || undefined,
    supervisor: readNombre(row.Supervisor),
    supervisorDocument: String(supervisor?.Documento ?? ''),
    supervisorRole: supervisor?.Cargo || undefined,
    // `OrdenadorGasto` solo trae un id: el nombre se resuelve aparte contra
    // `ordenadores` (ver `ordenadorGastoId` y el enriquecimiento del detalle).
    spendingManager: '',
    status,
    novelties
  };
  // Anulabilidad definitiva: activa en el backend + condiciones estrictas del dominio
  // (última novedad cuyo tipo corresponde al estado actual del contrato).
  contract.novelties = novelties.map(n => ({ ...n, canAnnul: n.canAnnul && canAnnulNovelty(contract, n) }));
  return contract;
}

/**
 * Id del ordenador del gasto del contrato, o `undefined` si no tiene uno
 * asignado (`OrdenadorGasto: null`). El backend guarda el id, no el nombre.
 */
export function ordenadorGastoId(row: ContratoGeneralDto): number | undefined {
  const valor = row.OrdenadorGasto;
  if (valor === null || valor === undefined || valor === '') return undefined;
  const id = typeof valor === 'object' ? valor.Id : valor;
  return Number(id) || undefined;
}

/** Convierte una fila de `poliza` (novedades_crud) al modelo de dominio. */
export function toPoliza(dto: PolizaDto): Poliza {
  return {
    id: String(dto.Id ?? ''),
    numeroPoliza: dto.NumeroPolizaId ?? '',
    entidadAseguradoraId: dto.EntidadAseguradoraId ?? null
  };
}

/** Convierte una entidad aseguradora del catálogo `entidad_aseguradora`. */
export function toAseguradora(dto: EntidadAseguradoraDto): Aseguradora {
  return {
    id: dto.Id ?? 0,
    nombre: dto.Nombre ?? dto.NomAseguradora ?? dto.Descripcion ?? ''
  };
}

/** Convierte un proveedor del backend en el cesionario que muestra el autocomplete. */
export function toAssignee(p: InformacionProveedorDto): Assignee {
  return {
    name: p.NomProveedor ?? '',
    documentNumber: String(p.NumDocumento ?? ''),
    // ponytail: el tipo exacto vive en informacion_persona_natural; se aproxima por tipo de persona.
    documentType: (p.Tipopersona ?? '').toUpperCase().includes('JUR') ? 'NIT' : 'CÉDULA DE CIUDADANÍA'
  };
}
