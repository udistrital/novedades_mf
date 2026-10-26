import { TestBed } from '@angular/core/testing';
import { fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';

import { HttpContractService } from './http-contract.service';
import { UserSessionService } from '../../../shared/auth/user-session.service';
import { NoveltyType } from '../domain/models/novelty-type.enum';
import { NoveltyDraft, ReinicioDraft, SuspensionDraft } from '../domain/models/novelty-draft.model';

/**
 * Pruebas de la **cascada de escritura**, el código más riesgoso del proyecto: es la
 * única parte que deja datos a medias si se equivoca de orden o se salta un paso, y
 * hasta ahora sus garantías solo estaban documentadas.
 *
 * Lo que se fija aquí:
 *
 * 1. El **orden real** de las escrituras (acta → validación → novedad → réplica → estado).
 * 2. Que un prerrequisito faltante **no escriba nada**.
 * 3. Que una réplica fallida **compense** desactivando la novedad, y propague el error.
 * 4. Que el `200` con `Type:"ERROR"` del mid se trate como fallo (el mid no usa el
 *    código HTTP para los errores de negocio).
 * 5. Que el tope de tiempo aborte la operación.
 * 6. Que el Reinicio replique con **PUT** sobre el id de Ágora y los demás con POST,
 *    sin emitir jamás una URL con `undefined`.
 */
describe('HttpContractService — cascada de escritura', () => {
  let service: HttpContractService;
  let mock: HttpTestingController;

  const CONTRATO_ID = '653_2025';

  const suspension: SuspensionDraft = {
    type: NoveltyType.SUSPENSION,
    solicitud: {
      fechaSolicitud: '2026-08-03',
      fechaExpedicionActa: '2026-08-03',
      numOficioSupervisor: 'su1',
      fechaOficioSupervisor: '2026-08-03',
      numOficioOrdenador: 'oc1',
      fechaOficioOrdenador: '2026-08-03'
    },
    periodoDias: 26,
    fechaInicio: '2025-02-10',
    fechaFin: '2025-03-05',
    fechaReinicio: '2025-03-06',
    motivo: 'Fuerza mayor',
    clausula: { activa: false, posicion: null, texto: '' }
  };

  const reinicio: ReinicioDraft = {
    type: NoveltyType.RESTART,
    solicitud: { fechaSolicitud: '2026-08-03', fechaExpedicionActa: '2026-08-03' },
    fechaInicioSuspension: '2025-02-10',
    fechaFinSuspension: '2025-03-05',
    periodoDias: 26,
    fechaReinicio: '2025-03-06'
  };

  /** Fila de `contrato_general` con todo lo que los payloads exigen. */
  function contratoGeneral(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      Id: 16387,
      NumeroContrato: '653',
      VigenciaContrato: 2025,
      ContratoSuscrito: [{ NumeroContratoSuscrito: '653', Vigencia: 2025, FechaSuscripcion: '2025-02-06' }],
      Contratista: 193,
      ValorContrato: 60533823,
      ObjetoContrato: 'PRESTAR SERVICIOS',
      PlazoEjecucion: 315,
      UnidadEjecucion: { Id: 205, Nombre: 'Dia(s)' },
      UnidadEjecutora: 1,
      FechaRegistro: '2025-02-07',
      Supervisor: { Nombre: 'SUP', Documento: '111', Cargo: 'JEFE' },
      OrdenadorGasto: 1,
      ...extra
    };
  }

  /**
   * Responde todas las lecturas pendientes con datos válidos. La cascada arranca con
   * una ráfaga de GETs (contrato, proveedor, estado, acta de inicio, ordenador,
   * catálogos) que no son lo que se está probando: interesan las escrituras.
   */
  function atenderLecturas(contrato: Record<string, unknown> = contratoGeneral()): void {
    // En vueltas: unas lecturas dependen de otras (el proveedor sale del contrato, el
    // estado sale de su id), así que aparecen recién cuando la anterior responde.
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const pendientes = mock.match(r => r.method === 'GET');
      if (!pendientes.length) return;
      pendientes.forEach(req => req.flush(cuerpoDeLectura(req.request.url, contrato)));
    }
  }

  function cuerpoDeLectura(url: string, contrato: Record<string, unknown>): object {
    if (url.includes('contrato_general')) return [contrato];
    if (url.includes('informacion_proveedor')) return [{ Id: 193, NumDocumento: '52706308', NomProveedor: 'CONTRATISTA UNO' }];
    if (url.includes('contrato_estado')) return [{ Id: 1, Estado: { Id: 4, NombreEstado: 'En ejecucion' } }];
    if (url.includes('estado_contrato')) return [{ Id: 2, NombreEstado: 'Suspendido' }];
    if (url.includes('acta_inicio')) return [{ FechaInicio: '2025-02-07', FechaFin: '2025-12-21' }];
    if (url.includes('ordenadores')) return [{ IdOrdenador: 1, NombreOrdenador: 'ORDENADOR UNO', Documento: '80038553' }];
    if (url.includes('tipo_novedad')) return [{ Id: 1, Nombre: 'Suspensión' }];
    if (url.includes('novedad_postcontractual')) return [{ Id: 8123, NumeroContrato: '653', Vigencia: 2025, PlazoEjecucion: 315, FechaInicio: '2025-02-07', UnidadEjecucion: 205 }];
    if (url.includes('novedades_poscontractuales')) return [{ Id: 10585, Activo: true, TipoNovedad: 1 }];
    // GET novedad/{numero}/{vigencia} del mid: historial de novedades.
    return { Type: 'OK', Code: '200', Body: [] };
  }

  /** Primera escritura pendiente (POST o PUT), sea cual sea su URL. */
  function escritura(): TestRequest {
    const [req] = mock.match(r => r.method === 'POST' || r.method === 'PUT');
    return req;
  }

  function crear(draft: NoveltyDraft = suspension): { error?: unknown; ok: boolean } {
    const resultado: { error?: unknown; ok: boolean } = { ok: false };
    service.createNovelty(CONTRATO_ID, draft, 'JVBERi0x').subscribe({
      next: () => (resultado.ok = true),
      error: (e: unknown) => (resultado.error = e)
    });
    return resultado;
  }

  const alertaOk = { Type: 'OK', Code: '200', Body: [{ Id: 10585, Enlace: 'uuid-acta' }] };

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

  it('escribe en el orden de la traza: acta → validación → novedad → réplica → estado', () => {
    const r = crear();
    atenderLecturas();

    const acta = escritura();
    expect(acta.request.method).toBe('POST');
    expect(acta.request.url).toContain('gestor_documental');
    // El PDF viaja en `file`: es lo que hace que "Ver acta" funcione después.
    expect((acta.request.body as { file: string }[])[0].file).toBe('JVBERi0x');
    acta.flush(alertaOk);

    const validar = escritura();
    expect(validar.request.url).toContain('validarCambioEstado');
    validar.flush({ Type: 'OK', Code: '200', Body: 'true' });

    const novedad = escritura();
    expect(novedad.request.url).toMatch(/novedades_mid\/v1\/novedad$|\/novedad$/);
    novedad.flush(alertaOk);

    const replica = escritura();
    expect(replica.request.method).toBe('POST');
    expect(replica.request.url).toContain('replica');
    replica.flush(alertaOk);

    const estado = escritura();
    expect(estado.request.method).toBe('POST');
    expect(estado.request.url).toContain('contrato_estado');
    estado.flush({});

    expect(r.ok).toBeTrue();
  });

  it('sin un dato obligatorio del contrato no escribe absolutamente nada', () => {
    // Sin `Contratista` no hay id de proveedor, que los payloads exigen.
    const r = crear();
    atenderLecturas(contratoGeneral({ Contratista: undefined }));

    expect(mock.match(req => req.method !== 'GET').length).toBe(0);
    expect(String(r.error)).toContain('No se registró la novedad');
  });

  it('un 200 con Type "ERROR" del mid es un fallo, no un éxito', () => {
    const r = crear();
    atenderLecturas();
    escritura().flush({ Type: 'error', Code: '400', Body: ['No se pudo subir el documento'] });

    expect(r.ok).toBeFalse();
    expect(r.error).toBeDefined();
    // Se cortó en el acta: no llegó a crear la novedad.
    expect(mock.match(req => req.method !== 'GET').length).toBe(0);
  });

  it('si la réplica falla, desactiva la novedad recién creada y propaga el error', () => {
    const r = crear();
    atenderLecturas();
    escritura().flush(alertaOk); // acta
    escritura().flush({ Type: 'OK', Code: '200', Body: 'true' }); // validación
    escritura().flush(alertaOk); // novedad → Id 10585
    escritura().flush({ Type: 'error', Code: '502', Body: ['Falló el registro en Titan'] }); // réplica

    // Compensación: relee la novedad y la reescribe inactiva.
    atenderLecturas();
    const compensacion = escritura();
    expect(compensacion.request.method).toBe('PUT');
    expect(compensacion.request.url).toContain('novedades_poscontractuales/10585');
    expect((compensacion.request.body as { Activo: boolean }).Activo).toBeFalse();
    compensacion.flush({});

    expect(r.error).toBeDefined();
    // El estado del contrato NO se registra: la novedad no llegó a existir.
    expect(mock.match(req => req.url.includes('contrato_estado') && req.method === 'POST').length).toBe(0);
  });

  it('aborta cuando la cascada supera el tiempo límite', fakeAsync(() => {
    const r = crear();
    atenderLecturas();
    // El acta nunca responde.
    tick(60_001);

    expect(String(r.error)).toContain('tiempo límite');
    // Se cancela lo que quedó en vuelo, sin dejar peticiones colgadas.
    mock.match(() => true).forEach(req => expect(req.cancelled).toBeTrue());
  }));

  it('el Reinicio replica con PUT sobre el id de Ágora, no con POST', () => {
    crear(reinicio);
    atenderLecturas();
    escritura().flush(alertaOk); // acta
    escritura().flush({ Type: 'OK', Code: '200', Body: 'true' }); // validación
    escritura().flush(alertaOk); // novedad

    // Antes del PUT resuelve la suspensión replicada en Ágora.
    const busqueda = mock.match(r => r.url.includes('novedad_postcontractual'));
    expect(busqueda.length).toBe(1);
    busqueda[0].flush([{ Id: 8123, NumeroContrato: '653', Vigencia: 2025, PlazoEjecucion: 315, FechaInicio: '2025-02-07', UnidadEjecucion: 205 }]);

    const replica = escritura();
    expect(replica.request.method).toBe('PUT');
    expect(replica.request.url).toContain('replica/8123');
    expect(replica.request.url).not.toContain('undefined');
    replica.flush(alertaOk);

    escritura().flush({}); // contrato_estado
  });

  it('sin suspensión replicada en Ágora no emite el PUT: nunca una URL con undefined', () => {
    const r = crear(reinicio);
    atenderLecturas();
    escritura().flush(alertaOk); // acta
    escritura().flush({ Type: 'OK', Code: '200', Body: 'true' }); // validación
    escritura().flush(alertaOk); // novedad

    mock.match(r => r.url.includes('novedad_postcontractual'))[0].flush([]);

    expect(mock.match(r => r.url.includes('/replica')).length).toBe(0);

    // Aun así compensa: la novedad ya estaba creada, y el error se propaga después.
    atenderLecturas();
    const compensacion = mock.match(r => r.method === 'PUT');
    expect(compensacion.length).toBe(1);
    compensacion[0].flush({});

    expect(String(r.error)).toContain('Ágora');
  });
});
