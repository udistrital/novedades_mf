import { NoveltyType } from './novelty-type.enum';
import { Assignee } from './assignee.model';

/** Datos de la solicitud comunes a las novedades que parten de oficios supervisor/ordenador. */
export interface RequestData {
  fechaSolicitud: string;
  fechaExpedicionActa: string;
  numOficioSupervisor: string;
  fechaOficioSupervisor: string;
  numOficioOrdenador: string;
  fechaOficioOrdenador: string;
}

/** Cláusula adicional opcional, reutilizada por todas las novedades. */
export interface AdditionalClause {
  activa: boolean;
  posicion: number | null;
  texto: string;
}

/**
 * Solicitud de adición de valor y prórroga de plazo sobre el contrato.
 *
 * Por requerimiento actualizado ambas secciones son obligatorias (la página
 * siempre envía `activa: true` en las dos). El campo se conserva porque el
 * repositorio discrimina con él el tipo enviado al backend
 * (NP_ADI / NP_PRO / NP_ADPRO) — hoy siempre NP_ADPRO.
 */
export interface AdicionProrrogaDraft {
  type: NoveltyType.ADDITION_EXTENSION;
  solicitud: {
    numSolicitud: string;
    fechaSolicitud: string;
    numOficio: string;
    fechaOficio: string;
    fechaActa: string;
  };
  adicion: {
    activa: boolean;
    numCdp: string;
    vigencia: string;
    valorAdicional: number | null;
    fechaAdicion: string;
  };
  prorroga: {
    activa: boolean;
    tiempoDias: number | null;
    fechaProrroga: string;
  };
  clausula: AdditionalClause;
}

/** Solicitud de suspensión temporal de la ejecución del contrato. */
export interface SuspensionDraft {
  type: NoveltyType.SUSPENSION;
  solicitud: RequestData;
  periodoDias: number | null;
  fechaInicio: string;
  fechaFin: string;
  fechaReinicio: string;
  motivo: string;
  clausula: AdditionalClause;
}

/** Solicitud de cesión: transfiere el contrato del cedente a un cesionario. */
export interface CesionDraft {
  type: NoveltyType.ASSIGNMENT;
  solicitud: RequestData;
  fechaSesion: string;
  fechaTerminacionCedente: string;
  valorDesembolsado: number | null;
  valorFavorCedente: number | null;
  diasFaltantes: number | null;
  cedulaCesionario: string;
  /**
   * Cesionario elegido en el autocomplete. El backend solo necesita su cédula
   * (resuelve el resto contra `informacion_proveedor`), pero el acta imprime su
   * nombre, así que se conserva lo que ya se mostró en pantalla en vez de volver
   * a consultarlo.
   */
  cesionario?: Assignee;
  considerando: { activo: boolean; posicion: number | null; texto: string };
  clausula: AdditionalClause;
}

/** Solicitud de terminación anticipada (liquidación bilateral) con sus saldos. */
export interface TerminacionDraft {
  type: NoveltyType.EARLY_TERMINATION;
  solicitud: RequestData;
  fechaTerminacion: string;
  fechaCertificacion: string;
  valorDesembolsado: number | null;
  saldoFavorContratista: number | null;
  saldoFavorUniversidad: number | null;
  clausula: AdditionalClause;
}

/** Solicitud de reinicio tras una suspensión; sus fechas derivan de la suspensión vigente. */
export interface ReinicioDraft {
  type: NoveltyType.RESTART;
  solicitud: {
    fechaSolicitud: string;
    fechaExpedicionActa: string;
  };
  fechaInicioSuspension: string; // Solo lectura: proviene de la suspensión vigente.
  fechaFinSuspension: string;
  periodoDias: number | null;
  fechaReinicio: string; // Solo lectura: calculada a partir de la suspensión.
}

/**
 * Unión discriminada (por `type`) de todas las solicitudes de novedad.
 *
 * Es el contrato entre los formularios de creación y el repositorio: cada
 * página construye su draft y el backend recibe una única forma tipada.
 */
export type NoveltyDraft =
  | AdicionProrrogaDraft
  | SuspensionDraft
  | CesionDraft
  | TerminacionDraft
  | ReinicioDraft;
