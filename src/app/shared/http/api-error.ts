import { HttpErrorResponse } from '@angular/common/http';
import { formatExecutionDate } from '../util/format.util';

/** Error de una operación, ya traducido a algo que el usuario pueda leer y accionar. */
export interface ApiErrorInfo {
  /** Código corto y estable para reportar a soporte; empieza por el estado HTTP cuando lo hay. */
  code: string;
  /** Qué pasó, en una frase. */
  detail: string;
  /** Qué puede hacer el usuario. Se omite cuando no hay nada que pueda hacer el usuario. */
  action?: string;
  /**
   * Servicio y ruta donde falló (`novedades_mid/v1/novedad`). Solo existe para los
   * errores HTTP: es el dato que le dice a soporte **dónde** mirar sin tener que
   * reproducir el trámite.
   */
  origen?: string;
}

/** Fallback cuando la operación falló sin dejar rastro utilizable. */
export const ERROR_DESCONOCIDO: ApiErrorInfo = {
  code: 'DESCONOCIDO',
  detail: 'La operación falló debido a un error desconocido.',
  action: 'Reintenta; si vuelve a fallar, reporta el caso a la Oficina Asesora de Sistemas.'
};

/**
 * Traduce el error de una llamada al backend en código, explicación y acción.
 *
 * Los errores que lanza el repositorio ya vienen con un mensaje en español
 * pensado para el usuario ("No se registró la novedad: falta…"), así que se
 * respetan tal cual. Los `HttpErrorResponse` sí se traducen: su mensaje nativo
 * ("Http failure response for…") no le dice nada a nadie.
 */
export function describeApiError(err: unknown): ApiErrorInfo {
  if (err instanceof HttpErrorResponse) return describeHttpError(err);
  if (err instanceof Error && err.message.trim()) {
    return { code: 'OPERACION-RECHAZADA', detail: err.message };
  }
  return ERROR_DESCONOCIDO;
}

function describeHttpError(err: HttpErrorResponse): ApiErrorInfo {
  // Mensaje que el propio servicio haya devuelto en el cuerpo: es más preciso
  // que cualquier texto genérico por código de estado.
  const delServicio = mensajeDelCuerpo(err.error);
  return { ...porEstado(err, delServicio), origen: endpointLegible(err.url) };
}

function porEstado(err: HttpErrorResponse, delServicio: string): ApiErrorInfo {
  switch (true) {
    // status 0: la petición no llegó a salir (red caída, CORS, o el gateway no respondió).
    case err.status === 0:
      return {
        code: 'SIN-CONEXION',
        detail: 'No se pudo contactar el servidor.',
        action: 'Revisa tu conexión a internet y reintenta nuevamente.'
      };
    case err.status === 401:
      return {
        code: '401-SESION',
        detail: 'La sesión expiró.',
        action: 'Vuelve a iniciar sesión y reintenta nuevamente.'
      };
    case err.status === 403:
      return {
        code: '403-PERMISO',
        detail: delServicio || 'Tu usuario no tiene permiso para ejecutar esta operación.',
        action: 'Verifica con la Oficina Asesora Jurídica que tu rol permita este trámite.'
      };
    case err.status === 404:
      return {
        code: '404-NO-ENCONTRADO',
        detail: delServicio || 'El servicio no encontró el contrato o la novedad indicados.',
        action: 'Vuelve al panel y busca el contrato de nuevo; pudo cambiar desde la última consulta.'
      };
    case err.status === 409:
      return {
        code: '409-CONFLICTO',
        detail: delServicio || 'El estado del contrato cambió y ya no admite esta novedad.',
        action: 'Vuelve al panel para ver el estado actual del contrato.'
      };
    case err.status === 400 || err.status === 422:
      return {
        code: `${err.status}-DATOS`,
        detail: delServicio || 'El servicio rechazó los datos enviados.',
        action: 'Revisa los datos del formulario; si están correctos, reporta el código a soporte.'
      };
    case err.status >= 500:
      return {
        code: `${err.status}-SERVIDOR`,
        detail: delServicio || 'El servicio institucional falló al procesar la solicitud.',
        action: 'Reintenta en unos minutos. Si persiste, reporta el código a la Oficina Asesora de Sistemas.'
      };
    default:
      return {
        code: `${err.status}-HTTP`,
        detail: delServicio || `El servicio respondió con un estado inesperado (${err.status}).`,
        action: 'Reintenta; si vuelve a fallar, reporta el error a soporte.'
      };
  }
}

/**
 * Servicio y ruta donde falló, en corto: `novedades_mid/v1/novedad`.
 *
 * Se recorta el host institucional y el prefijo `/apioas/`, que son iguales para
 * todas las APIs y solo alargan el reporte; el nombre del servicio ya viene en la
 * ruta. Un host sin punto (`localhost:8080`) sí se conserva, porque ahí la ruta
 * sola no dice de qué servicio se trata.
 */
export function endpointLegible(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const { host, pathname } = new URL(url, location.origin);
    const ruta = pathname.replace(/^\/apioas\//, '').replace(/^\/+/, '');
    return host.includes('.') ? ruta : `${host}/${ruta}`;
  } catch {
    return url;
  }
}

/**
 * Texto que el usuario copia para reportar el fallo a soporte (IRIS). Reúne en un
 * bloque pegable lo que el equipo necesita para diagnosticar sin reproducir el
 * trámite: qué falló, con qué código, **en qué servicio** y cuándo.
 */
export function errorReportText(info: ApiErrorInfo, contexto = ''): string {
  return [
    contexto && `Trámite: ${contexto}`,
    `Código: ${info.code}`,
    `Detalle: ${info.detail}`,
    info.action && `Acción: ${info.action}`,
    info.origen && `Servicio: ${info.origen}`,
    `Fecha: ${formatExecutionDate()}`
  ]
    .filter(Boolean)
    .join('\n');
}

/** Busca un mensaje legible dentro del cuerpo del error, que cada API nombra distinto. */
function mensajeDelCuerpo(body: unknown): string {
  if (typeof body === 'string') return body.trim().startsWith('<') ? '' : body.trim();
  if (!body || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  // FastAPI (servicio de actas) valida con Pydantic y devuelve el detalle en un
  // arreglo `detail: [{loc, msg, type}]`, con el motivo real en `msg`.
  if (Array.isArray(b['detail'])) return mensajesDePydantic(b['detail']);
  const candidato = b['Message'] ?? b['message'] ?? b['Error'] ?? b['error'] ?? b['Body'] ?? b['detail'];
  return typeof candidato === 'string' ? candidato.trim() : '';
}

function mensajesDePydantic(detalles: unknown[]): string {
  return detalles
    .map(d => (d && typeof d === 'object' ? String((d as { msg?: unknown }).msg ?? '') : String(d)))
    // Pydantic prefija los errores de validador con "Value error, ": ruido para el usuario.
    .map(msg => msg.replace(/^Value error,\s*/i, '').trim())
    .filter(Boolean)
    .join(' · ');
}
