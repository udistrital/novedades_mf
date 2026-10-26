import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HttpContractService } from './http-contract.service';
import { UserSessionService } from '../../../shared/auth/user-session.service';
import { availableVigencias } from '../domain/contract.rules';

/**
 * El catálogo de vigencias es el que llena los dos desplegables de año (filtro del
 * panel y vigencia del CDP). Lo que se fija aquí es que **nunca queden vacíos**: sin
 * años el usuario no puede ni buscar un contrato, así que un fallo de Ágora tiene que
 * caer al rango calculado en vez de propagarse.
 */
describe('HttpContractService — catálogo de vigencias', () => {
  let service: HttpContractService;
  let mock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpContractService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: UserSessionService,
          useValue: { session: () => ({ roles: ['JURIDICA'], documento: '1', email: '' }), usuarioRegistro: () => 'CC1' }
        }
      ]
    });
    service = TestBed.inject(HttpContractService);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  /** Caja con el último valor emitido: la emisión ocurre en el `flush`, no en el `subscribe`. */
  function vigencias(): { valor: string[] } {
    const caja = { valor: [] as string[] };
    service.getVigencias().subscribe(v => (caja.valor = v));
    return caja;
  }

  it('devuelve los años del backend como texto y de mayor a menor', () => {
    const resultado = vigencias();
    // Orden alterado a propósito: el primer elemento es la vigencia por defecto del CDP.
    mock.expectOne(r => r.url.endsWith('vigencia_contrato')).flush([2024, 2026, 2015, 2025]);

    expect(resultado.valor).toEqual(['2026', '2025', '2024', '2015']);
  });

  it('si el servicio falla cae al rango calculado, no a una lista vacía', () => {
    const resultado = vigencias();
    mock.expectOne(() => true).flush('', { status: 503, statusText: 'Service Unavailable' });

    expect(resultado.valor).toEqual(availableVigencias());
  });

  it('se consulta una sola vez por sesión', () => {
    vigencias();
    mock.expectOne(() => true).flush([2026, 2025]);

    expect(vigencias().valor).toEqual(['2026', '2025']);
    mock.expectNone(() => true);
  });
});
