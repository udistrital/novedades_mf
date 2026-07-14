import { NoveltyDraft } from '../../domain/models/novelty-draft.model';
import { NoveltyType } from '../../domain/models/novelty-type.enum';

/**
 * Payloads de escritura hacia `novedades_mid`.
 *
 * El mid discrimina por `tiponovedad` (códigos NP_*) y arma internamente la
 * transacción `NovedadPoscontractual + Fechas + Propiedad (+ Poliza)`.
 *
 * ⚠️ Los nombres de campo por tipo NO están documentados (viven en las
 * funciones `Construir*` de models/*.go del backend). Este archivo envía la
 * mejor aproximación con los datos del draft: si el backend rechaza el payload
 * al probar integrado, ESTE es el único archivo del frontend a corregir
 * (ver docs/adr/ADR-014 y el gap #1 de info/backend/API_ENDPOINTS_mid.md).
 */

/** Ids del catálogo `estado_contrato` documentados en endpoints_legacy.md. */
export const ESTADO_CONTRATO_ID = {
  SUSPENDIDO: 2,
  EN_EJECUCION: 4,
  TERMINADO: 8
} as const;

/** Discriminadores de POST {mid}novedad/ (API_ENDPOINTS_mid.md). */
type TipoNovedadMid = 'NP_SUS' | 'NP_CES' | 'NP_REI' | 'NP_TER' | 'NP_ADI' | 'NP_PRO' | 'NP_ADPRO';

/** Estado destino del contrato que produce cada novedad, o null si no cambia el estado. */
export function targetStateId(draft: NoveltyDraft): number | null {
  switch (draft.type) {
    case NoveltyType.SUSPENSION: return ESTADO_CONTRATO_ID.SUSPENDIDO;
    case NoveltyType.RESTART: return ESTADO_CONTRATO_ID.EN_EJECUCION;
    case NoveltyType.EARLY_TERMINATION: return ESTADO_CONTRATO_ID.TERMINADO;
    // Adición/prórroga no cambia el estado; el estado post-cesión ("Cesión pendiente
    // de póliza") no tiene id documentado y el legado no registra la llamada — lo
    // resuelve el backend (ver ambigüedad §2 del informe de endpoints legados).
    default: return null;
  }
}

function tipoNovedadMid(draft: NoveltyDraft): TipoNovedadMid {
  switch (draft.type) {
    case NoveltyType.SUSPENSION: return 'NP_SUS';
    case NoveltyType.ASSIGNMENT: return 'NP_CES';
    case NoveltyType.RESTART: return 'NP_REI';
    case NoveltyType.EARLY_TERMINATION: return 'NP_TER';
    case NoveltyType.ADDITION_EXTENSION:
      if (draft.adicion.activa && !draft.prorroga.activa) return 'NP_ADI';
      if (!draft.adicion.activa && draft.prorroga.activa) return 'NP_PRO';
      return 'NP_ADPRO';
  }
}

/**
 * Body de `POST {mid}novedad/`: discriminador + identificación del contrato +
 * campos de negocio del draft (aplanados, en el case minúsculas que usa el mid
 * en sus entradas: `tiponovedad`, `usuario`, `fecharegistro`).
 */
export function toNoveltyPayload(
  draft: NoveltyDraft,
  numeroContrato: string,
  vigencia: string,
  usuario: string
): Record<string, unknown> {
  const base = {
    tiponovedad: tipoNovedadMid(draft),
    numeroContrato,
    vigencia: Number(vigencia) || vigencia,
    usuario
  };

  switch (draft.type) {
    case NoveltyType.SUSPENSION:
      return {
        ...base,
        ...draft.solicitud,
        fechaInicio: draft.fechaInicio,
        fechaFin: draft.fechaFin,
        fechaReinicio: draft.fechaReinicio,
        periodoSuspension: draft.periodoDias,
        motivo: draft.motivo,
        clausulaAdicional: clausula(draft.clausula)
      };
    case NoveltyType.ASSIGNMENT:
      return {
        ...base,
        ...draft.solicitud,
        fechaCesion: draft.fechaSesion,
        fechaTerminacionCedente: draft.fechaTerminacionCedente,
        valorDesembolsado: draft.valorDesembolsado,
        valorFavorCedente: draft.valorFavorCedente,
        diasFaltantes: draft.diasFaltantes,
        cesionario: draft.cedulaCesionario,
        considerandoAdicional: draft.considerando.activo
          ? { posicion: draft.considerando.posicion, texto: draft.considerando.texto }
          : null,
        clausulaAdicional: clausula(draft.clausula)
      };
    case NoveltyType.RESTART:
      return {
        ...base,
        ...draft.solicitud,
        fechaInicioSuspension: draft.fechaInicioSuspension,
        fechaFinSuspension: draft.fechaFinSuspension,
        periodoSuspension: draft.periodoDias,
        fechaReinicio: draft.fechaReinicio
      };
    case NoveltyType.EARLY_TERMINATION:
      return {
        ...base,
        ...draft.solicitud,
        fechaTerminacion: draft.fechaTerminacion,
        fechaCertificacion: draft.fechaCertificacion,
        valorDesembolsado: draft.valorDesembolsado,
        saldoFavorContratista: draft.saldoFavorContratista,
        saldoFavorUniversidad: draft.saldoFavorUniversidad,
        clausulaAdicional: clausula(draft.clausula)
      };
    case NoveltyType.ADDITION_EXTENSION:
      return {
        ...base,
        ...draft.solicitud,
        adicion: draft.adicion.activa
          ? {
              numCdp: draft.adicion.numCdp,
              vigenciaCdp: Number(draft.adicion.vigencia) || draft.adicion.vigencia,
              valorAdicion: draft.adicion.valorAdicional,
              fechaAdicion: draft.adicion.fechaAdicion
            }
          : null,
        prorroga: draft.prorroga.activa
          ? { diasProrroga: draft.prorroga.tiempoDias, fechaProrroga: draft.prorroga.fechaProrroga }
          : null,
        clausulaAdicional: clausula(draft.clausula)
      };
  }
}

function clausula(c: { activa: boolean; posicion: number | null; texto: string }): unknown {
  return c.activa ? { posicion: c.posicion, texto: c.texto } : null;
}

/** Body de `POST {mid}validarCambioEstado/` y `POST {amazon}contrato_estado` (mismo shape documentado). */
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
