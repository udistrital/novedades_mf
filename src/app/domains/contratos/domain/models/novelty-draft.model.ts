import { NoveltyType } from './novelty-type.enum';

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

export interface CesionDraft {
  type: NoveltyType.ASSIGNMENT;
  solicitud: RequestData;
  fechaSesion: string;
  fechaTerminacionCedente: string;
  valorDesembolsado: number | null;
  valorFavorCedente: number | null;
  diasFaltantes: number | null;
  cedulaCesionario: string;
  considerando: { activo: boolean; posicion: number | null; texto: string };
  clausula: AdditionalClause;
}

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

export type NoveltyDraft =
  | AdicionProrrogaDraft
  | SuspensionDraft
  | CesionDraft
  | TerminacionDraft
  | ReinicioDraft;
