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
 *
 * `EARLY_TERMINATION` es la excepción: sus nombres de campo están confirmados
 * contra una traza real del cliente legado (ver docs/REVISION_CAMBIOS.md), por
 * eso arma su propio objeto plano en vez de usar `base`. Los demás tipos
 * siguen siendo la mejor aproximación, pendientes de la misma confirmación.
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

  if (draft.type === NoveltyType.EARLY_TERMINATION) {
    // Confirmado contra la traza real del cliente legado (ver docs/REVISION_CAMBIOS.md):
    // nombres de campo planos y en snake_case, sin "usuario" ni "numeroContrato".
    // "cesionario" viaja en la traza (valor 10) sin equivalente en el dominio de
    // terminación; se omite hasta confirmar con backend qué representa ahí.
    return {
      contrato: numeroContrato,
      vigencia,
      motivo: '',
      tiponovedad: tipoNovedadMid(draft),
      fecharegistro: new Date().toISOString(),
      numerosolicitud: '',
      fechasolicitud: draft.solicitud.fechaSolicitud,
      fechaexpedicion: draft.solicitud.fechaExpedicionActa,
      numerooficiosupervisor: draft.solicitud.numOficioSupervisor,
      numerooficioordenador: draft.solicitud.numOficioOrdenador,
      fechaoficiosupervisor: draft.solicitud.fechaOficioSupervisor,
      fechaoficioordenador: draft.solicitud.fechaOficioOrdenador,
      valor_desembolsado: draft.valorDesembolsado,
      saldo_contratista: draft.saldoFavorContratista,
      saldo_universidad: draft.saldoFavorUniversidad,
      // La traza envía el mismo valor en ambas fechas (última día trabajado = fecha
      // fin efectiva); "fechaCertificacion" del formulario no aparece en la traza.
      fecha_terminacion_anticipada: draft.fechaTerminacion,
      fechafinefectiva: draft.fechaTerminacion,
      estado: 'TERM',
      // El acta/PDF es un servicio aparte, aún no implementado (ver ADR correspondiente).
      enlace: ''
    };
  }

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
