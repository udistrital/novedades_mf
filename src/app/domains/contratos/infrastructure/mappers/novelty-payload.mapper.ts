import { Contract } from '../../domain/models/contract.entity';
import { NoveltyDraft, ReinicioDraft } from '../../domain/models/novelty-draft.model';
import { NoveltyType } from '../../domain/models/novelty-type.enum';
import { activeSuspension, contractEndDate } from '../../domain/contract.rules';
import { addDaysToDate } from '../../../../shared/util/format.util';
import { EstadoContratoDto, NovedadPoscontractualDto, NovedadPostcontractualArgoDto } from '../dtos/external-api.dto';

/**
 * Payloads de escritura hacia `novedades_mid` y `administrativa_amazon_api`.
 *
 * Los nombres de campo NO están documentados en el backend (viven en las
 * funciones `Construir*` de models/*.go): los de los cinco tipos están
 * **confirmados contra trazas reales del cliente legado** sobre el contrato
 * 653/2025 (ver `docs/endpoints_registrados.md`).
 *
 * Si el backend rechaza un payload, ESTE es el único archivo a corregir.
 */

/** Ids del catálogo `estado_contrato` (confirmado con negocio 2026-07-22). */
export const ESTADO_CONTRATO_ID = {
  'POR SUSCRIBIR': 1,
  SUSPENDIDO: 2,
  SUSCRITO: 3,
  EN_EJECUCION: 4,
  ANULADO: 5,
  FINALIZADO: 6,
  CANCELADO: 7,
  'FINALIZADO(ANTICIPADO)': 8,
  LIQUIDADO: 9,
  'NOVEDAD ANULADA': 10
} as const;

/** Discriminadores de POST {mid}novedad/ (API_ENDPOINTS_mid.md). */
type TipoNovedadMid = 'NP_SUS' | 'NP_CES' | 'NP_REI' | 'NP_TER' | 'NP_ADI' | 'NP_PRO' | 'NP_ADPRO';

/** `IdTipoDocumento` del acta de novedad en el gestor documental. */
export const ID_TIPO_DOCUMENTO_ACTA = 38;

/** Constantes de backend por tipo de novedad, tomadas de las trazas reales. */
export interface NovedadBackendConfig {
  /** Discriminador `tiponovedad` del POST `{mid}novedad/`. */
  tipoNovedad: TipoNovedadMid;
  /** Nombre exacto en el catálogo `tipo_novedad` (GET por nombre). */
  catalogo: string;
  /** Código de estado que viaja en el payload de la novedad y en los metadatos del acta. */
  estado: string;
  /** Prefijo del nombre del acta en `gestor_documental`. */
  actaPrefijo: string;
  /** Código de tipo de novedad de la réplica (catálogo Titan, serie 216-220). */
  replicaTipoNovedad: number;
  /** Estado destino del contrato, o `null` si la novedad no lo cambia. */
  estadoDestinoId: number | null;
}

/**
 * Código de suspensión en el catálogo de la réplica (216). El reinicio lo usa tres
 * veces: como su propio `replicaTipoNovedad`, para encontrar en Ágora la suspensión
 * que reanuda, y en el cuerpo del PUT — el mid rechaza la réplica del reinicio si
 * `TipoNovedad` no es 216.
 */
export const TIPO_NOVEDAD_REPLICA_SUSPENSION = 216;

/**
 * Constantes de backend por tipo, todas confirmadas contra trazas reales.
 * `EXTENSION` (prórroga sola) no aparece porque ningún formulario la produce:
 * el dominio la trata siempre como Adición/Prórroga.
 */
export const NOVEDAD_BACKEND: Readonly<Partial<Record<NoveltyType, NovedadBackendConfig>>> = {
  [NoveltyType.EARLY_TERMINATION]: {
    tipoNovedad: 'NP_TER',
    catalogo: 'Terminación Anticipada',
    estado: 'TERM',
    actaPrefijo: 'acta_terminacion_anticipada',
    replicaTipoNovedad: 218,
    estadoDestinoId: ESTADO_CONTRATO_ID['FINALIZADO(ANTICIPADO)']
  },
  [NoveltyType.SUSPENSION]: {
    tipoNovedad: 'NP_SUS',
    catalogo: 'Suspensión',
    estado: 'ENEJ',
    actaPrefijo: 'acta_suspension_contrato',
    replicaTipoNovedad: TIPO_NOVEDAD_REPLICA_SUSPENSION,
    estadoDestinoId: ESTADO_CONTRATO_ID.SUSPENDIDO
  },
  [NoveltyType.ASSIGNMENT]: {
    tipoNovedad: 'NP_CES',
    catalogo: 'Cesión',
    estado: 'ENEJ',
    actaPrefijo: 'acta_cesion_contrato',
    replicaTipoNovedad: 219,
    // La traza de cesión no llama `validarCambioEstado` ni `contrato_estado`: el
    // estado "Cesión pendiente de póliza" no está en el catálogo y el legado no
    // lo registra (ambigüedad §2 del informe de endpoints legados).
    estadoDestinoId: null
  },
  [NoveltyType.ADDITION_EXTENSION]: {
    tipoNovedad: 'NP_ADPRO',
    catalogo: 'Adición/Prórroga',
    estado: 'ENEJ',
    actaPrefijo: 'acta_adicion_prorroga_contrato',
    replicaTipoNovedad: 220,
    // Adición/prórroga no cambia el estado del contrato.
    estadoDestinoId: null
  },
  [NoveltyType.RESTART]: {
    tipoNovedad: 'NP_REI',
    catalogo: 'Reinicio',
    // "TERM" y no "ENEJ": el reinicio cierra (termina) la suspensión. Así lo
    // envía la traza, tanto en la novedad como en los metadatos del acta.
    estado: 'TERM',
    actaPrefijo: 'acta_reinicio_contrato',
    // Suspensión, NO un código propio: la réplica del reinicio no crea un registro
    // nuevo en Ágora, actualiza la suspensión que reanuda.
    replicaTipoNovedad: TIPO_NOVEDAD_REPLICA_SUSPENSION,
    estadoDestinoId: ESTADO_CONTRATO_ID.EN_EJECUCION
  }
};

/** Datos resueltos por el repositorio que los payloads de escritura necesitan. */
export interface NoveltyWriteContext {
  contract: Contract;
  vigencia: string;
  /** UUID devuelto por `gestor_documental`, que la novedad guarda como `enlace`. */
  enlace: string;
  usuario: string;
  /** Momento de la operación; parametrizado para poder fijarlo en pruebas. */
  now: Date;
  /** Cesionario ya resuelto contra `informacion_proveedor` (solo cesión). */
  cesionario?: { providerId: string; documento: string; nombre: string };
}

const ZONA_BOGOTA = '-05:00';

/**
 * Fecha de formulario (yyyy-mm-dd) o de contrato (dd/mm/yyyy) al instante ISO
 * que espera el backend: mediodía de Bogotá (`…T17:00:00.000Z`).
 *
 * Enviar medianoche UTC correría el día hacia atrás al leerse en Bogotá (UTC-5);
 * el legado usaba el mismo mediodía por esa razón. Es **formato de cable**, no
 * aritmética de dominio: ADR-013 (no replicar los parches de fecha del legado)
 * sigue vigente para los cálculos.
 */
export function bogotaNoonIso(date: string | null | undefined): string {
  if (!date) return '';
  const iso = date.includes('/') ? date.split('/').reverse().join('-') : date.slice(0, 10);
  const d = new Date(`${iso}T12:00:00${ZONA_BOGOTA}`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Sello del legado en el nombre del acta: año + mes sin relleno + día + hora + minuto. */
function actaFileName(prefijo: string, numero: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const sello = `${now.getFullYear()}${now.getMonth() + 1}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefijo}_${numero}_${sello}.pdf`;
}

/**
 * Fecha de fin efectiva del contrato tras aplicar la novedad.
 *
 * ponytail: para los cuatro tipos que no son reinicio se deriva de las fechas de la
 * propia novedad y del plazo vigente del dominio, sin llamar `acta_inicio`. Es una
 * aproximación acordada; el legado en cambio **encadena**: cada novedad parte del
 * `FechaFinEfectiva` que dejó registrado la anterior. Convertir los cuatro a ese
 * modelo exige una traza por tipo; hoy solo está confirmado el reinicio.
 */
function fechaFinEfectiva(draft: NoveltyDraft, contract: Contract): string {
  switch (draft.type) {
    case NoveltyType.EARLY_TERMINATION:
      return draft.fechaTerminacion;
    case NoveltyType.ASSIGNMENT:
      return draft.fechaSesion;
    case NoveltyType.ADDITION_EXTENSION:
      return addDaysToDate(draft.prorroga.fechaProrroga, Number(draft.prorroga.tiempoDias) || 0);
    case NoveltyType.SUSPENSION:
      // La suspensión corre el fin del contrato tantos días como dure.
      return addDaysToDate(contractEndDate(contract), Number(draft.periodoDias) || 0);
    case NoveltyType.RESTART:
      return finEfectivoDelReinicio(draft.periodoDias, contract);
    default:
      return '';
  }
}

/**
 * Fin efectivo que registra un reinicio.
 *
 * El cliente legado **no lo recalcula**: parte del `FechaFinEfectiva` que dejó la
 * suspensión y solo lo corrige si el reinicio la acorta
 * (`acta_reinicio.js:calcularFechaFin` → `fin − (período registrado − período real)`).
 * Como el formulario precarga las fechas de la suspensión vigente, el caso normal es
 * que el período coincida y la fecha se copie tal cual.
 *
 * Ese encadenamiento es lo que explica los **2 días de diferencia** de la traza del
 * 03/08: recalcular desde el acta de inicio acumula el desvío de cada novedad previa,
 * mientras que el legado arrastra el valor ya registrado.
 *
 * Sin fin efectivo registrado (contrato sin novedades previas en el histórico del mid)
 * se cae a la aproximación del dominio, que es lo único que queda.
 */
function finEfectivoDelReinicio(periodoDias: number | null | undefined, contract: Contract): string {
  const suspension = activeSuspension(contract);
  const registrado = suspension?.fechaFinEfectiva;
  if (!registrado) return contractEndDate(contract);
  const acortado = (suspension?.diasSuspension ?? 0) - (Number(periodoDias) || 0);
  return acortado > 0 ? addDaysToDate(registrado, -acortado) : registrado;
}

/**
 * Cuerpo del `PUT {mid}replica/{idArgo}` del reinicio.
 *
 * La réplica del reinicio no crea nada: el mid **reemplaza** con este cuerpo el
 * registro de la suspensión en Ágora (`novedad_postcontractual`) y luego llama a
 * Titan `reiniciar_contrato`. Por eso reenvía los campos del propio registro
 * —`NumeroContrato`, `Vigencia`, `PlazoEjecucion`, `FechaInicio`,
 * `UnidadEjecucion`—: el mid los copia tal cual y omitirlos los borraría.
 * Lo único nuevo son `FechaFin` (fin de la suspensión) y `FechaReinicio`.
 *
 * Mismo cuerpo que arma el cliente legado en `acta_reinicio.js`
 * (`contrato_obj_replica`), leído del mismo registro de Ágora.
 */
export function toReplicaReinicioPayload(
  draft: ReinicioDraft,
  ctx: NoveltyWriteContext,
  argo: NovedadPostcontractualArgoDto
): Record<string, unknown> {
  const { contract, now } = ctx;
  // Las fechas del registro de Ágora se reenvían tal como llegaron, pero pasadas a
  // ISO: si vinieran en el formato por defecto de Go, Postgres las rechazaría al
  // volver (el mismo tropiezo de la compensación).
  return conFechasIso({
    NumeroContrato: argo.NumeroContrato,
    Vigencia: argo.Vigencia,
    FechaRegistro: bogotaNoonIso(isoDay(now)),
    Contratista: Number(contract.contractorProviderId) || contract.contractorProviderId,
    Documento: contract.contractorId,
    PlazoEjecucion: argo.PlazoEjecucion,
    FechaInicio: argo.FechaInicio,
    // `FechaFin` es el fin de la SUSPENSIÓN, no del contrato.
    FechaFin: bogotaNoonIso(draft.fechaFinSuspension),
    FechaReinicio: bogotaNoonIso(draft.fechaReinicio),
    UnidadEjecucion: argo.UnidadEjecucion,
    TipoNovedad: TIPO_NOVEDAD_REPLICA_SUSPENSION
  });
}

/** Body de `POST {mid}gestor_documental`: arreglo de un solo documento (el acta). */
export function toGestorDocumentalPayload(
  cfg: NovedadBackendConfig,
  ctx: Omit<NoveltyWriteContext, 'enlace'>,
  fileBase64 = ''
): unknown[] {
  const { contract, vigencia, now } = ctx;
  return [
    {
      IdTipoDocumento: ID_TIPO_DOCUMENTO_ACTA,
      nombre: actaFileName(cfg.actaPrefijo, contract.number, now),
      // PDF completo en base64, sin prefijo `data:` — igual que la traza de reinicio
      // del legado (`"file":"JVB…"`). Es lo que hace que "Ver acta" encuentre el
      // documento después; sin él, el gestor guarda un registro vacío.
      file: fileBase64,
      descripcion: `${contract.number}${vigencia}`,
      metadatos: {
        contrato: Number(contract.number) || contract.number,
        vigencia: Number(vigencia) || vigencia,
        estado: cfg.estado,
        // La traza de adición/prórroga omite `idNovedad`; se envía siempre vacío
        // (el mid lo ignora) para no ramificar el payload por tipo.
        idNovedad: ''
      }
    }
  ];
}

/**
 * Body de `POST {mid}validarCambioEstado/` en **modo arreglo** (`models.EstadoContrato[]`),
 * que según los docs del mid solo VALIDA la transición. El modo objeto, en cambio,
 * la aplica llamando `contrato_estado` por dentro: por eso este flujo usa el arreglo
 * y registra el estado en un POST explícito, igual que el legado.
 *
 * Elementos: [estado actual del contrato, registro del catálogo del estado destino].
 */
export function toValidarCambioEstadoPayload(
  nombreEstadoActual: string,
  estadoDestino: EstadoContratoDto
): unknown[] {
  return [{ NombreEstado: nombreEstadoActual }, estadoDestino];
}

/** Body de `POST {mid}novedad/`, con los nombres de campo de la traza real por tipo. */
export function toNoveltyPayload(draft: NoveltyDraft, ctx: NoveltyWriteContext): Record<string, unknown> {
  const { contract, vigencia, enlace, now } = ctx;
  const cfg = NOVEDAD_BACKEND[draft.type];

  const base = {
    contrato: contract.number,
    vigencia,
    tiponovedad: cfg?.tipoNovedad,
    estado: cfg?.estado,
    enlace,
    motivo: '',
    fecharegistro: bogotaNoonIso(isoDay(now)),
    fechafinefectiva: bogotaNoonIso(fechaFinEfectiva(draft, contract)),
    // Contratista vigente del contrato (id de `informacion_proveedor`): la traza lo
    // envía como `cesionario` incluso en novedades que no son cesión.
    cesionario: Number(contract.contractorProviderId) || contract.contractorProviderId
  };

  switch (draft.type) {
    case NoveltyType.EARLY_TERMINATION:
      return {
        ...base,
        ...solicitudComun(draft.solicitud),
        numerosolicitud: '',
        valor_desembolsado: draft.valorDesembolsado,
        saldo_contratista: draft.saldoFavorContratista,
        saldo_universidad: draft.saldoFavorUniversidad,
        fecha_terminacion_anticipada: bogotaNoonIso(draft.fechaTerminacion)
      };

    case NoveltyType.SUSPENSION:
      return {
        ...base,
        ...solicitudComun(draft.solicitud),
        numerosolicitud: '',
        motivo: draft.motivo,
        periodosuspension: draft.periodoDias,
        fechasuspension: bogotaNoonIso(draft.fechaInicio),
        fechafinsuspension: bogotaNoonIso(draft.fechaFin),
        fechareinicio: bogotaNoonIso(draft.fechaReinicio)
      };

    case NoveltyType.RESTART:
      return {
        ...base,
        // El reinicio no captura oficios (no usa `solicitudComun`): solo las dos
        // fechas del acta. El resto de campos son los ceros/vacíos de la traza.
        fechasolicitud: bogotaNoonIso(draft.solicitud.fechaSolicitud),
        fechaexpedicion: bogotaNoonIso(draft.solicitud.fechaExpedicionActa),
        numerosolicitud: '',
        numerooficioestadocuentas: 0,
        valor_desembolsado: 0,
        saldo_contratista: 0,
        saldo_universidad: 0,
        observacion: '',
        // Período de la suspensión que se reanuda, repetido tal como quedó
        // registrado en ella: el reinicio la cierra, no la redefine.
        periodosuspension: draft.periodoDias,
        fechasuspension: bogotaNoonIso(draft.fechaInicioSuspension),
        fechafinsuspension: bogotaNoonIso(draft.fechaFinSuspension),
        fechareinicio: bogotaNoonIso(draft.fechaReinicio)
      };

    case NoveltyType.ASSIGNMENT:
      return {
        ...base,
        ...solicitudComun(draft.solicitud),
        numerosolicitud: null,
        cedente: Number(contract.contractorProviderId) || contract.contractorProviderId,
        cesionario: Number(ctx.cesionario?.providerId) || ctx.cesionario?.providerId,
        fechacesion: bogotaNoonIso(draft.fechaSesion),
        valor_desembolsado: draft.valorDesembolsado,
        valor_a_favor: draft.valorFavorCedente,
        numeroactaentrega: 0,
        numerocdp: '',
        vigenciacdp: '',
        poliza: ''
      };

    case NoveltyType.ADDITION_EXTENSION:
      return {
        ...base,
        numerosolicitud: draft.solicitud.numSolicitud,
        fechasolicitud: bogotaNoonIso(draft.solicitud.fechaSolicitud),
        fechaexpedicion: bogotaNoonIso(draft.solicitud.fechaActa),
        // La adición solo captura el oficio del ordenador; el legado envía "n.a."
        // en el del supervisor.
        numerooficiosupervisor: 'n.a.',
        numerooficioordenador: draft.solicitud.numOficio,
        // String() explícito: el input es `type="number"`, así que Angular guarda un
        // number en el control pese a que el draft lo declare string, y la traza
        // exige `"numerocdp":"1233"` entre comillas.
        numerocdp: String(draft.adicion.numCdp ?? ''),
        vigenciacdp: String(draft.adicion.vigencia ?? ''),
        // RP no se captura en el formulario; el legado envía ceros.
        numerorp: '0',
        vigenciarp: '0',
        valoradicion: draft.adicion.valorAdicional,
        fechaadicion: bogotaNoonIso(draft.adicion.fechaAdicion),
        tiempoprorroga: draft.prorroga.tiempoDias,
        fechaprorroga: bogotaNoonIso(draft.prorroga.fechaProrroga)
      };

    default:
      return base;
  }
}

/** Campos de oficios/fechas compartidos por terminación, suspensión y cesión. */
function solicitudComun(s: {
  fechaSolicitud: string;
  fechaExpedicionActa: string;
  numOficioSupervisor: string;
  fechaOficioSupervisor: string;
  numOficioOrdenador: string;
  fechaOficioOrdenador: string;
}): Record<string, unknown> {
  return {
    fechasolicitud: bogotaNoonIso(s.fechaSolicitud),
    fechaexpedicion: bogotaNoonIso(s.fechaExpedicionActa),
    numerooficiosupervisor: s.numOficioSupervisor,
    numerooficioordenador: s.numOficioOrdenador,
    fechaoficiosupervisor: bogotaNoonIso(s.fechaOficioSupervisor),
    fechaoficioordenador: bogotaNoonIso(s.fechaOficioOrdenador)
  };
}

/**
 * Body de la réplica hacia Ágora/Titan. `esFechaActual: true` en todas las
 * trazas. Los códigos `TipoNovedad` (216-220) son del catálogo de la réplica,
 * distintos de los de `tipo_novedad`.
 *
 * Cuatro tipos van por `POST {mid}replica` (crean el registro). Reinicio va por
 * `PUT {mid}replica/{idArgo}` y arma su cuerpo aparte: ver `toReplicaReinicioPayload`.
 */
export function toReplicaPayload(draft: NoveltyDraft, ctx: NoveltyWriteContext): Record<string, unknown> {
  const { contract, vigencia, now } = ctx;
  const cfg = NOVEDAD_BACKEND[draft.type];

  // Terminación Anticipada arma su propio objeto (mismas claves y valores que las
  // demás, pero en el orden exacto de la traza real): no la comparte con `base`
  // porque, a diferencia de los otros tres tipos, NO lleva `UnidadEjecucion`.
  if (draft.type === NoveltyType.EARLY_TERMINATION) {
    return {
      NumeroContrato: contract.number,
      Vigencia: Number(vigencia) || vigencia,
      FechaRegistro: bogotaNoonIso(isoDay(now)),
      FechaInicio: bogotaNoonIso(contract.startDate),
      // La terminación replica el fin real de la novedad, no un delta.
      FechaFin: bogotaNoonIso(draft.fechaTerminacion),
      Contratista: Number(contract.contractorProviderId) || contract.contractorProviderId,
      // La terminación replica el plazo completo del contrato, no un delta.
      PlazoEjecucion: contract.executionTerm,
      ValorNovedad: draft.valorDesembolsado,
      Documento: contract.contractorId,
      NumeroCdp: 0,
      VigenciaCdp: 0,
      TipoNovedad: cfg?.replicaTipoNovedad,
      esFechaActual: true
    };
  }

  const base = {
    esFechaActual: true,
    NumeroContrato: contract.number,
    Vigencia: Number(vigencia) || vigencia,
    FechaRegistro: bogotaNoonIso(isoDay(now)),
    Contratista: Number(contract.contractorProviderId) || contract.contractorProviderId,
    Documento: contract.contractorId,
    TipoNovedad: cfg?.replicaTipoNovedad,
    NumeroCdp: 0,
    VigenciaCdp: 0
  };
  // `UnidadEjecucion` sí va en los otros tres tipos (suspensión, cesión, adición/prórroga).
  const conUnidad = { ...base, UnidadEjecucion: contract.executionUnitId };

  switch (draft.type) {
    case NoveltyType.SUSPENSION:
      return {
        ...conUnidad,
        PlazoEjecucion: draft.periodoDias,
        FechaInicio: bogotaNoonIso(draft.fechaInicio),
        FechaFin: bogotaNoonIso(draft.fechaFin)
      };

    case NoveltyType.ASSIGNMENT:
      return {
        ...conUnidad,
        // El contratista de la réplica pasa a ser el cesionario.
        Contratista: Number(ctx.cesionario?.providerId) || ctx.cesionario?.providerId,
        DocumentoActual: contract.contractorId,
        DocumentoNuevo: ctx.cesionario?.documento ?? '',
        NombreCompleto: ctx.cesionario?.nombre ?? '',
        // La traza envía siempre 1 (la cesión replica un rango de un día: inicio = fin).
        // NO se usa `diasFaltantes` del formulario: ese campo son días faltantes por
        // pago al cedente, un dato de plata, no un plazo de ejecución.
        PlazoEjecucion: 1,
        FechaInicio: bogotaNoonIso(draft.fechaSesion),
        FechaFin: bogotaNoonIso(draft.fechaSesion)
      };

    case NoveltyType.ADDITION_EXTENSION:
      return {
        ...conUnidad,
        PlazoEjecucion: draft.prorroga.tiempoDias,
        FechaInicio: bogotaNoonIso(draft.prorroga.fechaProrroga),
        FechaFin: bogotaNoonIso(fechaFinEfectiva(draft, contract)),
        ValorNovedad: draft.adicion.valorAdicional,
        NumeroCdp: Number(draft.adicion.numCdp) || 0,
        VigenciaCdp: Number(draft.adicion.vigencia) || 0
      };

    default:
      return base;
  }
}

/**
 * Body del PUT de compensación sobre `novedades_poscontractuales/{id}`: desactiva
 * la novedad cuando la réplica falla. Se parte del registro leído porque el CRUD
 * Beego reemplaza el objeto completo (no hace merge parcial).
 */
export const MOTIVO_REPLICA_FALLIDA = 'Error en la réplica';

export function toCompensacionPayload(
  registro: NovedadPoscontractualDto,
  tipoNovedadId?: number
): Record<string, unknown> {
  // `TipoNovedad` viaja plano en la traza (`"TipoNovedad":3`) pero el GET del CRUD
  // lo devuelve anidado ({Id, Nombre}): se aplana con el id del catálogo ya
  // resuelto y, si no lo hay, con el Id del propio objeto anidado.
  const tipo = tipoNovedadId ?? idPlano(registro['TipoNovedad']);
  return { ...conFechasIso(registro), TipoNovedad: tipo, Activo: false, Motivo: MOTIVO_REPLICA_FALLIDA };
}

/**
 * `2026-08-24 14:00:26.032834 +0000 +0000` → fecha y hora, sin el resto.
 *
 * Exige el **espacio** separador, la marca del formato de Go: una fecha que ya viene
 * en ISO (con `T`) se deja intacta. Aceptar también la `T` recortaba los milisegundos
 * y, peor, convertía en `Z` un desfase real (`…T12:00:00-05:00` → cinco horas menos).
 */
const TIMESTAMP_GO = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/;

/**
 * Reescribe a ISO-8601 las marcas de tiempo que el CRUD devuelve **en el formato
 * por defecto de Go** (`2026-08-24 14:00:26.032834 +0000 +0000`).
 *
 * El registro se relee y se reenvía completo porque el CRUD Beego reemplaza el
 * objeto, no hace merge — pero **no sabe leer su propio formato de salida**:
 * devolvérselo tal cual hace que Postgres rechace el PUT entero con
 * `invalid input syntax for type timestamp`, y la compensación falle. El cliente
 * legado tampoco lo reenviaba crudo: sus trazas mandan siempre `…T12:00:00Z`.
 *
 * Se normaliza **cualquier** campo con esa forma, no una lista de nombres: el
 * registro es un índice laxo y el CRUD puede sumar fechas nuevas. Lo usan la
 * compensación de novedades y la escritura de la póliza, que reenvían registros
 * releídos del mismo CRUD.
 */
export function conFechasIso(registro: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(registro).map(([clave, valor]) => {
      if (typeof valor !== 'string') return [clave, valor];
      const fecha = TIMESTAMP_GO.exec(valor);
      return [clave, fecha ? `${fecha[1]}T${fecha[2]}Z` : valor];
    })
  );
}

function idPlano(valor: unknown): unknown {
  return valor && typeof valor === 'object' ? (valor as { Id?: unknown }).Id : valor;
}

/**
 * Body de `POST {amazon}contrato_estado`: registra el nuevo estado del contrato.
 * `NumeroContrato` es el Id principal de `contrato_general`, no el número humano.
 */
export function toCambioEstadoPayload(
  estadoId: number,
  numeroContrato: string,
  vigencia: string,
  usuario: string
): Record<string, unknown> {
  return {
    Estado: { Id: estadoId },
    FechaRegistro: new Date().toISOString(),
    NumeroContrato: numeroContrato,
    Usuario: usuario,
    Vigencia: Number(vigencia) || vigencia
  };
}

/** Fecha (yyyy-mm-dd) de un `Date`, en hora local. */
function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
