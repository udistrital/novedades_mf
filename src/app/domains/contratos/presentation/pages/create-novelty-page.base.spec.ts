import { volverAlContrato } from './create-novelty-page.base';

/**
 * Al volver al panel, el contrato recién tramitado viaja en la URL: es lo que hace
 * que el listado se repueble aunque el estado en memoria esté vacío (entrada por
 * enlace directo o recarga), que era cuando el panel aparecía en blanco.
 */
describe('volverAlContrato', () => {
  it('parte el id compuesto en número y vigencia', () => {
    expect(volverAlContrato('653_2025')).toEqual({ contrato: '653', vigencia: '2025' });
  });

  it('sin vigencia manda el número solo, no "undefined"', () => {
    expect(volverAlContrato('653')).toEqual({ contrato: '653', vigencia: '' });
  });

  it('sin id no manda parámetros: el panel se queda como estaba', () => {
    expect(volverAlContrato('')).toEqual({});
  });
});
