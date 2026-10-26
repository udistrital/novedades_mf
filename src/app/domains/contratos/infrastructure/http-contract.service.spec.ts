import { HttpErrorResponse } from '@angular/common/http';

import {
  aNombrePropio,
  anulacionRechazada,
  cdpRpVigente,
  errorDeReplica,
  estadoTrasAnulacion,
  rutaCdpRp
} from './http-contract.service';
import { NoveltyType } from '../domain/models/novelty-type.enum';

/**
 * La anulación es la única escritura sin traza confirmada, así que su respuesta
 * puede llegar en dos formas distintas. Lo que se fija aquí es que **ninguna de
 * las dos pueda reportar éxito cuando el backend rechazó** — el fallo silencioso
 * que estas pruebas existen para impedir.
 */
describe('anulacionRechazada', () => {
  describe('forma utils_oas', () => {
    it('rechaza cuando Success es false', () => {
      expect(anulacionRechazada({ Success: false, Message: 'No permitido' })).toBe(true);
    });

    it('rechaza cuando Status es 4xx o 5xx', () => {
      expect(anulacionRechazada({ Status: 400 })).toBe(true);
      expect(anulacionRechazada({ Status: '500' })).toBe(true);
    });

    it('acepta un éxito explícito', () => {
      expect(anulacionRechazada({ Success: true, Status: 200 })).toBe(false);
    });
  });

  describe('forma Alert del mid', () => {
    it('rechaza un Alert de error, aunque no traiga Success', () => {
      // Este es el caso que antes pasaba por éxito: `undefined !== false`.
      expect(anulacionRechazada({ Type: 'error', Code: '400' })).toBe(true);
    });

    it('rechaza por código 4xx/5xx aunque el Type no diga error', () => {
      expect(anulacionRechazada({ Code: '500' })).toBe(true);
    });

    it('acepta un Alert exitoso', () => {
      expect(anulacionRechazada({ Type: 'success', Code: '200' })).toBe(false);
    });
  });

  describe('respuestas que no dicen nada (se aceptan a propósito)', () => {
    // Se aceptan a propósito: el camino feliz ya funciona y no se rompe por una
    // forma no documentada. Ver el comentario de la función.
    it('acepta null, undefined y el objeto vacío', () => {
      expect(anulacionRechazada(null)).toBe(false);
      expect(anulacionRechazada(undefined)).toBe(false);
      expect(anulacionRechazada({})).toBe(false);
    });
  });
});

/**
 * Cuando la réplica falla, la novedad recién creada se desactiva. Si eso NO ocurre,
 * el sistema queda en el peor estado —novedad activa que Ágora/Titan no conoce— y el
 * usuario tiene que enterarse: es el único que puede reportarlo.
 */
describe('errorDeReplica', () => {
  it('propaga el error original intacto cuando sí se compensó', () => {
    const original = new HttpErrorResponse({ status: 502, statusText: 'Bad Gateway' });
    // Mismo objeto, no una copia: la UI necesita el HttpErrorResponse para dar el código real.
    expect(errorDeReplica(original, true)).toBe(original);
  });

  it('avisa que la novedad quedó activa cuando no se pudo compensar', () => {
    const resultado = errorDeReplica(new Error('La réplica falló.'), false) as Error;
    expect(resultado.message).toContain('La réplica falló.');
    expect(resultado.message).toContain('quedó registrada sin replicar');
  });

  it('conserva el detalle de un error HTTP al envolverlo', () => {
    const resultado = errorDeReplica(new HttpErrorResponse({ status: 0 }), false) as Error;
    // El detalle viene de `describeApiError`, no de un texto genérico.
    expect(resultado.message).toContain('No se pudo contactar el servidor.');
    expect(resultado.message).toContain('ATENCIÓN');
  });
});

/**
 * Los dos nombres del cuadro de firmas se imprimen en nombre propio, pero el
 * backend los devuelve en mayúsculas. El resto de nombres del acta (contratista,
 * ordenador) NO pasan por aquí: van tal como los entrega Ágora.
 */
describe('aNombrePropio', () => {
  it('pasa de mayúsculas a nombre propio', () => {
    expect(aNombrePropio('LAURA NIÑO')).toBe('Laura Niño');
    expect(aNombrePropio('WILSON JAIRO PINZON CASALLAS')).toBe('Wilson Jairo Pinzon Casallas');
  });

  it('respeta tildes y la Ñ al cambiar de caja', () => {
    expect(aNombrePropio('JOSÉ ÁNGEL MUÑOZ')).toBe('José Ángel Muñoz');
  });

  it('tolera espacios de más y cadenas vacías', () => {
    expect(aNombrePropio('  ANA   TORRES  ')).toBe('Ana   Torres');
    expect(aNombrePropio('')).toBe('');
  });
});

/**
 * El CDP y el CRP del encabezado del acta salen de `financiera_jbpm`, que devuelve
 * el histórico completo del contrato. Imprimir el registro equivocado pondría en un
 * documento legal un certificado presupuestal que no es el vigente.
 */
describe('cdpRpVigente', () => {
  // Respuesta real del contrato 483/2025.
  const respuesta = {
    cdp_rp_tercero: {
      cdp_rp: [
        { vigencia: '2025', cdp: '438', rp: '2029' },
        { vigencia: '2025', cdp: '4097', rp: '11238' }
      ]
    }
  };

  it('toma el último registro del histórico, no el primero', () => {
    expect(cdpRpVigente(respuesta)).toEqual({ cdp: '4097', rp: '11238' });
  });

  it('devuelve vacío cuando el contrato no tiene CDP/RP', () => {
    expect(cdpRpVigente({ cdp_rp_tercero: { cdp_rp: [] } })).toEqual({ cdp: '', rp: '' });
    expect(cdpRpVigente({})).toEqual({ cdp: '', rp: '' });
    expect(cdpRpVigente(null)).toEqual({ cdp: '', rp: '' });
  });
});

describe('rutaCdpRp', () => {
  it('lleva la unidad ejecutora a cuatro dígitos', () => {
    expect(rutaCdpRp('483', '2025', 1)).toBe('cdprptercerocontrato/2025/483/0001/12');
  });

  it('asume la unidad 1 cuando el contrato no la trae', () => {
    expect(rutaCdpRp('483', '2025')).toBe('cdprptercerocontrato/2025/483/0001/12');
  });
});

/**
 * El mid revierte el estado del contrato a "En ejecución" pase lo que pase (postea
 * los estados 10 y 4 sin mirar el tipo). Anular un reinicio con esa regla deja el
 * contrato ejecutándose cuando su suspensión sigue vigente.
 */
describe('estadoTrasAnulacion', () => {
  it('devuelve el contrato a Suspendido (2) al anular un reinicio', () => {
    expect(estadoTrasAnulacion(NoveltyType.RESTART)).toBe(2);
  });

  it('no escribe nada en los demás tipos: "En ejecución" ya es el estado correcto', () => {
    for (const tipo of [
      NoveltyType.SUSPENSION,
      NoveltyType.ASSIGNMENT,
      NoveltyType.ADDITION_EXTENSION,
      NoveltyType.EARLY_TERMINATION
    ]) {
      expect(estadoTrasAnulacion(tipo)).toBeNull();
    }
  });
});
