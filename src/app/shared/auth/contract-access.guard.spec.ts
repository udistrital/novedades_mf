import { accionDeRuta } from './contract-access.guard';
import { ContractAction } from '../../domains/contratos/domain/models/contract-status.enum';

/**
 * De la URL sale la acción que se pretende ejecutar, y de ahí la comprobación contra
 * el estado del contrato. Si esta lectura falla, el guard deja pasar cualquier cosa
 * (acción desconocida ⇒ se rechaza, que es el lado seguro).
 */
describe('accionDeRuta', () => {
  it('reconoce las seis rutas de novedad', () => {
    const casos: [string, ContractAction][] = [
      ['/contratos/653_2025/novedades/adicion-prorroga', ContractAction.ADICION_PRORROGA],
      ['/contratos/653_2025/novedades/suspension', ContractAction.SUSPENSION],
      ['/contratos/653_2025/novedades/cesion', ContractAction.CESION],
      ['/contratos/653_2025/novedades/terminacion', ContractAction.TERMINACION],
      ['/contratos/653_2025/novedades/reinicio', ContractAction.REINICIO],
      ['/contratos/653_2025/novedades/poliza', ContractAction.AGREGAR_POLIZA]
    ];
    for (const [url, esperada] of casos) {
      expect(accionDeRuta(url)).toBe(esperada);
    }
  });

  it('ignora los parámetros de consulta', () => {
    expect(accionDeRuta('/contratos/653_2025/novedades/suspension?contrato=653')).toBe(ContractAction.SUSPENSION);
  });

  it('devuelve undefined cuando el segmento no es una acción conocida', () => {
    expect(accionDeRuta('/contratos/653_2025/novedades')).toBeUndefined();
    expect(accionDeRuta('/contratos/653_2025/novedades/liquidacion')).toBeUndefined();
    expect(accionDeRuta('/')).toBeUndefined();
  });
});
