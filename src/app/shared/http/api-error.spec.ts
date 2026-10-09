import { HttpErrorResponse } from '@angular/common/http';
import { ERROR_DESCONOCIDO, describeApiError, endpointLegible, errorReportText } from './api-error';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, url: 'https://api/novedad' });
}

describe('describeApiError', () => {
  it('respeta el mensaje de los errores que lanza el repositorio', () => {
    const info = describeApiError(new Error('No se registró la novedad: falta el plazo de ejecución del contrato.'));
    expect(info.detail).toBe('No se registró la novedad: falta el plazo de ejecución del contrato.');
    expect(info.code).toBe('OPERACION-RECHAZADA');
  });

  it('traduce el status 0 como problema de conexión, no como error del servidor', () => {
    const info = describeApiError(httpError(0));
    expect(info.code).toBe('SIN-CONEXION');
    expect(info.action).toContain('conexión');
  });

  it('sugiere volver a iniciar sesión en un 401', () => {
    const info = describeApiError(httpError(401));
    expect(info.code).toBe('401-SESION');
    expect(info.action).toContain('iniciar sesión');
  });

  it('usa el mensaje del servicio cuando el cuerpo lo trae', () => {
    const info = describeApiError(httpError(400, { Message: 'La vigencia no corresponde al contrato.' }));
    expect(info.detail).toBe('La vigencia no corresponde al contrato.');
    expect(info.code).toBe('400-DATOS');
  });

  it('incluye el status real en los errores de servidor y propone reintentar', () => {
    const info = describeApiError(httpError(503));
    expect(info.code).toBe('503-SERVIDOR');
    expect(info.action).toContain('Reintenta');
  });

  // Cuerpos reales de `POST novedad/generaracta` (generador de actas de novedades_mid).
  it('traduce el 422 del generador de actas con su campo, no el genérico del cuerpo', () => {
    const info = describeApiError(httpError(422, {
      success: false,
      error: 'datos del acta inválidos',
      detail: [{ campo: 'datos.valor_adicion', mensaje: 'la adición supera el 50% del valor inicial (tope 15000000)' }]
    }));
    expect(info.detail).toBe('valor_adicion: la adición supera el 50% del valor inicial (tope 15000000)');
    expect(info.code).toBe('422-DATOS');
  });

  it('une varios detalles de validación en un solo mensaje', () => {
    const info = describeApiError(httpError(422, {
      detail: [
        { campo: 'datos.contrato.supervisor', mensaje: 'es obligatorio' },
        { campo: 'datos.saldo_universidad', mensaje: 'el balance no cuadra con el valor del contrato' }
      ]
    }));
    expect(info.detail).toBe('contrato.supervisor: es obligatorio · saldo_universidad: el balance no cuadra con el valor del contrato');
  });

  it('un JSON con un tipo equivocado (campo "datos") muestra solo el mensaje', () => {
    const info = describeApiError(httpError(422, {
      detail: [{ campo: 'datos', mensaje: 'estructura inválida: fecha "2026-06-01T00:00:00Z" inválida; use YYYY-MM-DD' }]
    }));
    expect(info.detail).toBe('estructura inválida: fecha "2026-06-01T00:00:00Z" inválida; use YYYY-MM-DD');
  });

  it('lee el error de los 400 y 500 del generador, que no traen detalle', () => {
    expect(describeApiError(httpError(500, { success: false, error: 'no fue posible generar el acta' })).detail)
      .toBe('no fue posible generar el acta');
  });

  it('ignora un cuerpo HTML (página de error del gateway) en vez de mostrarlo crudo', () => {
    const info = describeApiError(httpError(502, '<html><body>Bad Gateway</body></html>'));
    expect(info.detail).not.toContain('<html>');
    expect(info.code).toBe('502-SERVIDOR');
  });

  it('cae al genérico cuando no hay nada utilizable', () => {
    expect(describeApiError(null)).toEqual(ERROR_DESCONOCIDO);
    expect(describeApiError(new Error('  '))).toEqual(ERROR_DESCONOCIDO);
  });

  it('conserva dónde falló, que es lo que soporte necesita para ubicarlo', () => {
    // El host de la prueba (`api`) no lleva punto, así que se conserva: ver `endpointLegible`.
    expect(describeApiError(httpError(500)).origen).toBe('api/novedad');
    // Un error que no viene de HTTP no tiene servicio que reportar.
    expect(describeApiError(new Error('x')).origen).toBeUndefined();
  });
});

/**
 * El reporte a soporte se pega en un ticket de IRIS: tiene que decir qué falló, con
 * qué código y **en qué servicio**, sin obligar al usuario a transcribir nada.
 */
describe('endpointLegible', () => {
  it('recorta host y prefijo del gateway, y deja el servicio con su ruta', () => {
    expect(endpointLegible('https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1/novedad'))
      .toBe('novedades_mid/v1/novedad');
  });

  it('conserva el host cuando no identifica al servicio por sí solo', () => {
    // El generador de actas corre en local: sin el host, "v1/novedad/generaracta" no
    // dice de qué servicio se trata.
    expect(endpointLegible('http://localhost:8081/v1/novedad/generaracta')).toBe('localhost:8081/v1/novedad/generaracta');
  });

  it('sin url no inventa nada', () => {
    expect(endpointLegible(null)).toBe('');
    expect(endpointLegible('')).toBe('');
  });
});

describe('errorReportText', () => {
  const info = { code: '422-DATOS', detail: 'El balance no cuadra.', origen: 'localhost:8081/v1/novedad/generaracta' };

  it('reúne trámite, código, detalle y servicio en un bloque pegable', () => {
    const texto = errorReportText(info, 'Terminación Anticipada');
    expect(texto).toContain('Trámite: Terminación Anticipada');
    expect(texto).toContain('Código: 422-DATOS');
    expect(texto).toContain('Detalle: El balance no cuadra.');
    expect(texto).toContain('Servicio: localhost:8081/v1/novedad/generaracta');
    expect(texto.split('\n').length).toBe(5);
  });

  it('omite las líneas que no tienen dato, sin dejar huecos', () => {
    const texto = errorReportText({ code: 'DESCONOCIDO', detail: 'Falló.' });
    expect(texto).not.toContain('Trámite:');
    expect(texto).not.toContain('Servicio:');
    expect(texto.split('\n').length).toBe(3);
  });
});
