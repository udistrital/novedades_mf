import { Contract, NoveltySummary } from '../../domain/models/contract.entity';
import { NoveltyStatus, NoveltyType } from '../../domain/models/novelty-type.enum';
import { ContractStatus } from '../../domain/models/contract-status.enum';
import { Assignee } from '../../domain/models/assignee.model';
import { Aseguradora, Poliza } from '../../domain/models/poliza.model';
import { canAnnulNovelty } from '../../domain/contract.rules';
import { numberToWords, toDisplayDate } from '../../../../shared/util/format.util';
import { environment } from '../../../../../environments/environment';
import {
  ContratoEstadoDto,
  ContratoGeneralDto,
  EntidadAseguradoraDto,
  InformacionProveedorDto,
  NovedadMidDto,
  PolizaDto
} from '../dtos/legacy-api.dto';

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

const ESTADOS_CONTRATO: ReadonlyArray<[string, ContractStatus]> = [
  ['SUSCRITO', ContractStatus.SUSCRITO],
  ['EN EJECUCION', ContractStatus.EN_EJECUCION],
  ['SUSPENDIDO', ContractStatus.SUSPENDIDO],
  ['CESION', ContractStatus.CESION_PENDIENTE_POLIZA], // "Cesión pendiente de póliza" o variantes.
  ['FINALIZADO', ContractStatus.FINALIZADO],
  ['CANCELADO', ContractStatus.CANCELADO],
  ['TERMINADO', ContractStatus.TERMINADO],
  ['FIN ANTICIPADO', ContractStatus.TERMINADO],
  ['INICIO', ContractStatus.INICIO]
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
function toDdMmYyyy(value: string | null | undefined): string {
  if (!value) return '';
  return value.includes('/') ? value.split(' ')[0] : toDisplayDate(value.slice(0, 10));
}

/** Lee un valor que puede llegar como string plano o como objeto con Nombre. */
function readNombre(value: { Nombre?: string; TipoContrato?: string } | string | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.Nombre ?? value.TipoContrato ?? '';
}

/** Plazo en el formato que espera el dominio: "NUEVE ( 9 ) MESES". */
function toInitialTerm(plazo: number | string | undefined, unidad: string): string {
  const n = Number(plazo);
  if (!plazo || Number.isNaN(n) || n <= 0) return String(plazo ?? '');
  return `${numberToWords(n)} ( ${n} ) ${unidad.toUpperCase() || 'MESES'}`;
}

/**
 * Lee el primer campo presente entre varios nombres candidatos. Los `GetNovedad*`
 * del mid no están documentados campo a campo (models/*.go del backend): esta
 * lectura por candidatos es el único punto a corregir al confirmar los nombres.
 */
function readCandidate(raw: NovedadMidDto, keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return raw[key];
  }
  return undefined;
}

function toNoveltySummary(item: NovedadMidDto): NoveltySummary {
  const raw = item.NovedadPoscontractual ?? item;
  const valorAdicion = Number(readCandidate(item, ['ValorAdicion', 'valor_adicion', 'ValorNovedad', 'Valor', 'valor']));
  const diasProrroga = Number(readCandidate(item, ['DiasProrroga', 'dias_prorroga', 'Dias', 'dias', 'PeriodoProrroga']));
  const cesionarioId = readCandidate(item, ['Cesionario', 'cesionario', 'DocumentoNuevo', 'documento_nuevo']);
  const enlace = readCandidate(raw, ['Enlace', 'EnlaceDocumento']);
  const fechaExpedicion = readCandidate(raw, ['FechaExpedicion', 'FechaCreacion']);
  return {
    id: String(raw.Id ?? ''),
    type: TIPO_NOVEDAD[Number(raw.TipoNovedad)] ?? NoveltyType.ADDITION_EXTENSION,
    expeditionDate: toDdMmYyyy(String(fechaExpedicion ?? '')),
    status: toStatus(raw.Estado),
    // El acta se sirve desde novedades_mid; el query de la novedad solo trae el enlace (id del documento).
    documentUrl: enlace ? `${environment.NOVEDADES_MID_SERVICE}gestor_documental/${String(enlace)}` : undefined,
    canAnnul: raw.Activo !== false,
    valorAdicion: Number.isFinite(valorAdicion) && valorAdicion > 0 ? valorAdicion : undefined,
    diasProrroga: Number.isFinite(diasProrroga) && diasProrroga > 0 ? diasProrroga : undefined,
    cesionarioId: cesionarioId !== undefined ? String(cesionarioId) : undefined
  };
}

/** Convierte las novedades del mid; la anulabilidad definitiva se resuelve en `toContract`. */
export function toNoveltySummaries(items: NovedadMidDto[]): NoveltySummary[] {
  return items.map(toNoveltySummary);
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
  const contract: Contract = {
    // Id compuesto: el backend identifica contratos por número + vigencia, no por un id único.
    id: `${numero}_${vigencia}`,
    number: numero,
    contractType: readNombre(row.TipoContrato),
    contractorName: proveedor?.NomProveedor ?? '',
    contractorId: String(proveedor?.NumDocumento ?? ''),
    contractingEntity: 'Universidad Distrital Francisco José de Caldas',
    totalValue: Number(row.ValorContrato ?? row.Valor) || 0,
    object: String(row.ObjetoContrato ?? row.Objeto ?? ''),
    initialTerm: toInitialTerm(row.PlazoEjecucion, readNombre(row.UnidadEjecucion) || 'MESES'),
    // ponytail: fecha de registro como inicio; la fecha real de inicio vive en
    // acta_inicio (vía contrato_suscrito) — encadenar cuando se conecten las actas.
    startDate: toDdMmYyyy(row.FechaRegistro) || `01/01/${vigencia}`,
    supervisor: readNombre(row.Supervisor),
    supervisorDocument: String(supervisor?.Documento ?? ''),
    spendingManager: readNombre(row.OrdenadorGasto),
    status,
    novelties
  };
  // Anulabilidad definitiva: activa en el backend + condiciones estrictas del dominio
  // (última novedad cuyo tipo corresponde al estado actual del contrato).
  contract.novelties = novelties.map(n => ({ ...n, canAnnul: n.canAnnul && canAnnulNovelty(contract, n) }));
  return contract;
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
