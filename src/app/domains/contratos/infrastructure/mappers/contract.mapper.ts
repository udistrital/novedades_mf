import { Contract, NoveltySummary } from '../../domain/models/contract.entity';
import { NoveltyStatus, NoveltyType } from '../../domain/models/novelty-type.enum';
import { Assignee } from '../../domain/models/assignee.model';
import { numberToWords, toDisplayDate } from '../../../../shared/util/format.util';
import { ContratoGeneralDto, InformacionProveedorDto, NovedadMidDto } from '../dtos/legacy-api.dto';

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
  if (e.includes('TRAMITE') || e.includes('TRÁMITE')) return NoveltyStatus.IN_PROCESS;
  return NoveltyStatus.IN_EXECUTION;
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

function toNoveltySummary(item: NovedadMidDto): NoveltySummary {
  const raw = item.NovedadPoscontractual ?? item;
  return {
    id: String(raw.Id ?? ''),
    type: TIPO_NOVEDAD[Number(raw.TipoNovedad)] ?? NoveltyType.ADDITION_EXTENSION,
    expeditionDate: toDdMmYyyy(raw.FechaCreacion),
    status: toStatus(raw.Estado),
    documentUrl: raw.EnlaceDocumento || undefined,
    canAnnul: raw.Activo !== false
  };
}

export function toNoveltySummaries(items: NovedadMidDto[]): NoveltySummary[] {
  const list = items.map(toNoveltySummary);
  // ponytail: regla del cliente legado — solo la última novedad (por fecha) es anulable.
  const dateKey = (n: NoveltySummary) => n.expeditionDate.split('/').reverse().join('');
  const latest = list.reduce<NoveltySummary | null>((a, b) => (!a || dateKey(b) >= dateKey(a) ? b : a), null);
  return list.map(n => (n === latest ? n : { ...n, canAnnul: false }));
}

export function toContract(
  row: ContratoGeneralDto,
  proveedor: InformacionProveedorDto | null,
  novelties: NoveltySummary[]
): Contract {
  const suscrito = row.ContratoSuscrito?.[0];
  const numero = String(suscrito?.NumeroContratoSuscrito ?? row.NumeroContrato ?? '');
  const vigencia = String(row.VigenciaContrato ?? row.Vigencia ?? suscrito?.Vigencia ?? '');
  return {
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
    spendingManager: readNombre(row.OrdenadorGasto),
    novelties
  };
}

export function toAssignee(p: InformacionProveedorDto): Assignee {
  return {
    name: p.NomProveedor ?? '',
    documentNumber: String(p.NumDocumento ?? ''),
    // ponytail: el tipo exacto vive en informacion_persona_natural; se aproxima por tipo de persona.
    documentType: (p.Tipopersona ?? '').toUpperCase().includes('JUR') ? 'NIT' : 'CÉDULA DE CIUDADANÍA'
  };
}
