import { Contract } from '../../domain/models/contract.entity';
import { ActaOptions } from '../../domain/repositories/acta-generator.repository';
import { AdditionalClause, NoveltyDraft } from '../../domain/models/novelty-draft.model';
import { NoveltyType } from '../../domain/models/novelty-type.enum';
import { activeSuspension, contractEndDate, currentContractValue, currentTermDays } from '../../domain/contract.rules';
import { addDaysToDate, addDaysToTerm, formatTerm, numberToWords, periodDays, toIsoDate } from '../../../../shared/util/format.util';

/**
 * Payloads de `actas_novedad_mid`, el servicio que genera el PDF del acta.
 *
 * Es un servicio **temporal**: cuando se reemplace, este archivo y
 * `http-acta-mid.service.ts` son lo único que hay que reescribir (ver
 * `IActaGenerator`). Nada de aquí se filtra al dominio ni a la presentación.
 *
 * Convenciones del servicio (§2 de `docs_integracion_agente_actas_mid.md`):
 * fechas en ISO `yyyy-mm-dd`, valores como número, plazos **ya en letras**, y
 * los campos opcionales ausentes se imprimen como `________`. Todo lo que el
 * servicio calcula por su cuenta (fecha de reinicio de una suspensión, nuevo
 * valor total, saldo del cesionario) NO se envía.
 */

/** Ruta del acta de cada tipo de novedad; `undefined` = ese tipo no tiene acta. */
export const ACTA_ENDPOINT: Readonly<Partial<Record<NoveltyType, string>>> = {
  [NoveltyType.SUSPENSION]: 'v1/actas/suspension',
  [NoveltyType.RESTART]: 'v1/actas/reinicio',
  [NoveltyType.ADDITION_EXTENSION]: 'v1/actas/adicion-prorroga',
  [NoveltyType.ASSIGNMENT]: 'v1/actas/cesion',
  [NoveltyType.EARLY_TERMINATION]: 'v1/actas/terminacion-liquidacion'
};

/** Respuesta de los cinco endpoints (§4): el PDF viaja en base64, sin prefijo `data:`. */
export interface ActaMidResponse {
  success?: boolean;
  filename?: string;
  file_base64?: string;
  metadata?: { tipo_acta?: string; size_bytes?: number };
}

/**
 * Body del acta correspondiente al tipo de la novedad.
 *
 * `opciones` aporta lo que el acta imprime pero no sale ni del contrato ni de la
 * solicitud: el cuadro de firmas y el tamaño de letra. Son opcionales en los cinco
 * endpoints; los que no se conozcan se omiten y el servicio pone `________`
 * (o su tamaño por defecto, 10 puntos).
 */
export function toActaPayload(
  contract: Contract,
  draft: NoveltyDraft,
  opciones: ActaOptions = {}
): Record<string, unknown> {
  const contrato = bloqueContrato(contract, opciones);
  const comunes = camposComunes(opciones);

  switch (draft.type) {
    case NoveltyType.SUSPENSION:
      return {
        contrato,
        ...comunes,
        fecha_expedicion_acta: draft.solicitud.fechaExpedicionActa,
        fecha_inicio_suspension: draft.fechaInicio,
        fecha_fin_suspension: draft.fechaFin,
        motivo: draft.motivo,
        fecha_solicitud: draft.solicitud.fechaSolicitud,
        // `fecha_reinicio` NO se envía: el servicio la deriva del fin de la suspensión.
        numero_oficio_supervisor: draft.solicitud.numOficioSupervisor,
        fecha_oficio_supervisor: draft.solicitud.fechaOficioSupervisor,
        numero_oficio_ordenador: draft.solicitud.numOficioOrdenador,
        fecha_oficio_ordenador: draft.solicitud.fechaOficioOrdenador,
        ...nuevaClausula(draft.clausula)
      };

    case NoveltyType.RESTART:
      return {
        contrato,
        ...comunes,
        fecha_expedicion_acta: draft.solicitud.fechaExpedicionActa,
        // Datos de la suspensión que se reanuda: el acta la cita como antecedente.
        suspension_previa: {
          fecha_acta:
            toIsoDate(activeSuspension(contract)?.expeditionDate ?? '') || draft.fechaInicioSuspension,
          fecha_inicio_suspension: draft.fechaInicioSuspension,
          fecha_fin_suspension: draft.fechaFinSuspension
        },
        fecha_reinicio: draft.fechaReinicio
      };

    case NoveltyType.ADDITION_EXTENSION:
      return {
        // Única novedad que capta el CDP en el formulario: lo digitado manda sobre
        // lo que trajo la financiera, y su vigencia solo existe aquí.
        contrato: {
          ...contrato,
          ...(draft.adicion.numCdp ? { cdp_numero: String(draft.adicion.numCdp) } : {}),
          cdp_vigencia: Number(draft.adicion.vigencia) || undefined
        },
        ...comunes,
        fecha_expedicion_acta: draft.solicitud.fechaActa,
        valor_adicion: draft.adicion.valorAdicional,
        // El formulario capta la prórroga en días; el servicio compone meses + días.
        prorroga_dias: draft.prorroga.tiempoDias,
        nuevo_plazo_contrato: addDaysToTerm(contract.initialTerm, draft.prorroga.tiempoDias),
        numero_oficio: draft.solicitud.numOficio,
        fecha_oficio: draft.solicitud.fechaOficio,
        numero_solicitud: draft.solicitud.numSolicitud,
        fecha_solicitud: draft.solicitud.fechaSolicitud,
        ...nuevaClausula(draft.clausula)
      };

    case NoveltyType.ASSIGNMENT:
      return {
        contrato,
        ...comunes,
        fecha_expedicion_acta: draft.solicitud.fechaExpedicionActa,
        cesionario: {
          nombre: draft.cesionario?.name ?? '',
          documento: draft.cesionario?.documentNumber || draft.cedulaCesionario,
          tipo_documento: draft.cesionario?.documentType?.includes('NIT') ? 'NIT' : 'C.C.'
        },
        fecha_cesion: draft.fechaSesion,
        fecha_terminacion_cedente: draft.fechaTerminacionCedente,
        valor_desembolsado: draft.valorDesembolsado,
        valor_a_favor: draft.valorFavorCedente,
        // Los tres plazos son obligatorios y el formulario no los captura: se
        // derivan de las fechas. El del cedente es lo que ejecutó (inicio del
        // contrato → su terminación) y el del cesionario lo que queda por ejecutar
        // (fecha de cesión → fin vigente del contrato).
        plazo_cedente: plazoEnLetras(periodDays(contract.startDate, draft.fechaTerminacionCedente)),
        plazo_cesionario: plazoEnLetras(periodDays(draft.fechaSesion, contractEndDate(contract))),
        // Días faltantes por pago al cedente. Es obligatorio pero el campo del
        // formulario es opcional: sin dato va el marcador que el acta imprime
        // cuando no lo hay, no una cifra inventada.
        dias_pago_cedente: diasEnLetras(draft.diasFaltantes),
        fecha_solicitud: draft.solicitud.fechaSolicitud,
        numero_oficio_supervisor: draft.solicitud.numOficioSupervisor,
        fecha_oficio_supervisor: draft.solicitud.fechaOficioSupervisor,
        ...(draft.considerando.activo && draft.considerando.texto
          ? { nuevo_considerando: draft.considerando.texto }
          : {}),
        ...nuevaClausula(draft.clausula)
      };

    case NoveltyType.EARLY_TERMINATION:
      return {
        contrato,
        ...comunes,
        fecha_expedicion_acta: draft.solicitud.fechaExpedicionActa,
        fecha_terminacion_anticipada: draft.fechaTerminacion,
        // Los tres saldos van tal como los digitó el usuario, aunque el servicio
        // pueda calcular el de la universidad: el acta es un documento legal y no
        // debe imprimir cifras que el usuario no aprobó. Si no cuadran contra el
        // valor vigente, el servicio responde 422 y ese error es el dato útil.
        valor_desembolsado: draft.valorDesembolsado,
        saldo_contratista: draft.saldoFavorContratista,
        saldo_universidad: draft.saldoFavorUniversidad,
        fecha_certificacion: draft.fechaCertificacion,
        // Los efectos legales arrancan el día siguiente al de la terminación, tal
        // como los relaciona el ejemplo del servicio (termina el 30, efectos el 1).
        fecha_efectos_legales: addDaysToDate(draft.fechaTerminacion, 1),
        numero_oficio_supervisor: draft.solicitud.numOficioSupervisor,
        fecha_oficio_supervisor: draft.solicitud.fechaOficioSupervisor,
        numero_oficio_ordenador: draft.solicitud.numOficioOrdenador,
        fecha_oficio_ordenador: draft.solicitud.fechaOficioOrdenador,
        ...nuevaClausula(draft.clausula)
      };

    default:
      return { contrato, ...comunes };
  }
}

/**
 * Bloque `contrato`, obligatorio en las cinco actas: los datos maestros que el
 * servicio no consulta y el front reenvía.
 *
 * El `rol` (calidad/cargo) sí se envía desde el 2026-08-24: el acta lo imprime en
 * tres sitios del ordenador —"en calidad de …", "el … solicitó" y bajo su firma— y
 * el backend sí lo expone (`ordenadores.RolOrdenador`, `Supervisor.Cargo`), al
 * contrario de lo que asumía ADR-016.
 *
 * `resolucion` (la designación del ordenador) sale de `ordenadores.InfoResolucion`
 * y solo aplica a él: el acta la cita justo después de su cargo.
 *
 * El CDP y el CRP llegan por `opciones` porque no salen de Ágora sino de
 * `financiera_jbpm` (ver `IContractRepository.getCdpRp`). Se omiten si no se
 * conocen: el acta imprime entonces su marcador, no una cadena vacía.
 */
function bloqueContrato(contract: Contract, o: ActaOptions): Record<string, unknown> {
  return {
    numero_contrato: contract.number,
    vigencia: Number(contract.id.split('_').pop()) || 0,
    tipo_contrato: contract.contractType,
    objeto_contrato: contract.object,
    // Valor y plazo VIGENTES (con las adiciones y prórrogas ya registradas): son la
    // base contra la que el servicio valida el tope del 50 % y el balance de la
    // liquidación, los mismos topes que aplican los formularios.
    valor_contrato: currentContractValue(contract),
    plazo: contract.initialTerm,
    plazo_dias: currentTermDays(contract),
    fecha_suscripcion: toIsoDate(contract.subscriptionDate ?? contract.startDate),
    fecha_inicio: toIsoDate(contract.startDate),
    unidad_ejecutora: contract.executingUnit ?? 1,
    contratista: { nombre: contract.contractorName, documento: contract.contractorId },
    supervisor: persona(contract.supervisor, contract.supervisorDocument, contract.supervisorRole),
    ordenador: persona(
      contract.spendingManager,
      contract.spendingManagerDocument ?? '',
      contract.spendingManagerRole,
      contract.spendingManagerResolution
    ),
    ...(o.cdp ? { cdp_numero: o.cdp } : {}),
    ...(o.rp ? { rp_numero: o.rp } : {})
  };
}

/**
 * `Persona` del servicio. `rol` y `resolucion` son opcionales: se omiten si no se
 * conocen, en vez de mandarlos vacíos — el acta imprime entonces su propio
 * marcador `________`. `resolucion` solo la lleva el ordenador del gasto.
 */
function persona(nombre: string, documento: string, rol?: string, resolucion?: string): Record<string, unknown> {
  return { nombre, documento, ...(rol ? { rol } : {}), ...(resolucion ? { resolucion } : {}) };
}

/**
 * Campos comunes a las cinco actas que no salen del contrato ni de la solicitud.
 * Cada uno se omite si no se conoce: el servicio ya tiene su propio valor por
 * defecto (`________` para los nombres, 10 puntos para la letra), y mandarlo vacío
 * lo sustituiría por una cadena en blanco.
 */
function camposComunes(o: ActaOptions): Record<string, unknown> {
  return {
    ...(o.elaboro ? { elaboro: o.elaboro } : {}),
    ...(o.jefeJuridica ? { jefe_juridica_nombre: o.jefeJuridica } : {}),
    ...(o.tamanoLetra ? { tamano_letra: o.tamanoLetra } : {})
  };
}

/** La cláusula adicional del formulario es la `nueva_clausula` del acta; se omite si no está activa. */
function nuevaClausula(clausula: AdditionalClause): Record<string, string> {
  return clausula?.activa && clausula.texto ? { nueva_clausula: clausula.texto } : {};
}

/**
 * Días → plazo en letras, en el formato único del negocio: "DIEZ ( 10 ) MESES Y
 * QUINCE ( 15 ) DÍAS". Es el mismo `formatTerm` del plazo del contrato, para que el
 * acta no mezcle unidades entre el plazo que cita y los que deriva.
 *
 * Sin dato (o un período no positivo, p. ej. una cesión posterior al fin del
 * contrato) devuelve el marcador que el acta imprime cuando falta un opcional, en
 * vez de un plazo en cero.
 */
function plazoEnLetras(dias: number | null): string {
  const n = Number(dias);
  return Number.isFinite(n) && n > 0 ? formatTerm(n) : SIN_DATO;
}

/**
 * Días en letras, sin convertir a meses: "QUINCE ( 15 ) DÍAS".
 *
 * Solo para los días faltantes de pago al cedente, que no son un plazo de ejecución
 * sino un conteo de días; expresarlo en meses ("CERO ( 0 ) MESES Y QUINCE ( 15 ) DÍAS")
 * diría algo distinto de lo que el acta afirma.
 */
function diasEnLetras(dias: number | null): string {
  const n = Number(dias);
  if (!Number.isFinite(n) || n <= 0) return SIN_DATO;
  return `${numberToWords(n)} ( ${n} ) ${n === 1 ? 'DÍA' : 'DÍAS'}`;
}

/** Marcador del aplicativo original para un dato que no se tiene. */
const SIN_DATO = '________';
