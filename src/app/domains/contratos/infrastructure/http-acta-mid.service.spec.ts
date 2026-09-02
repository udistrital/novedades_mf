import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { HttpActaMidService } from './http-acta-mid.service';
import { NoveltyType } from '../domain/models/novelty-type.enum';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { Contract } from '../domain/models/contract.entity';
import { NoveltyDocument } from '../domain/models/novelty-document.model';
import { describeApiError } from '../../../shared/http/api-error';

/**
 * El servicio de actas es **temporal** y su contrato vive en dos archivos: este y
 * `acta-payload.mapper.ts`. Lo que se fija aquí es lo que rompería al reemplazarlo:
 * que cada tipo de novedad vaya a su propia ruta, y que sus errores lleguen a la
 * pantalla como algo legible en vez de "Http failure response for…".
 */
describe('HttpActaMidService', () => {
  let service: HttpActaMidService;
  let mock: HttpTestingController;

  /** Mínimo que el mapper del acta necesita para armar el bloque `contrato`. */
  const contract = {
    id: '653_2025',
    number: '653',
    contractType: 'Prestación de servicios',
    contractorName: 'CONTRATISTA UNO',
    contractorId: '52706308',
    totalValue: 60_533_823,
    object: 'PRESTAR SERVICIOS',
    initialTerm: 'TRESCIENTOS QUINCE ( 315 ) DIAS',
    startDate: '07/02/2025',
    endDate: '21/12/2025',
    supervisor: 'SUPERVISOR UNO',
    supervisorDocument: '111',
    spendingManager: 'ORDENADOR UNO',
    spendingManagerDocument: '222',
    novelties: []
  } as unknown as Contract;

  /**
   * Solicitud con todos los campos que cualquiera de las cinco ramas del mapper puede
   * leer: cada tipo usa los suyos e ignora el resto. Aquí se prueba el enrutamiento y
   * el manejo de la respuesta, no el contenido del payload (eso es `acta-payload.mapper.spec`).
   */
  function draftDe(type: NoveltyType): NoveltyDraft {
    return {
      type,
      solicitud: {
        fechaSolicitud: '2026-08-03',
        fechaExpedicionActa: '2026-08-03',
        fechaActa: '2026-08-03',
        numSolicitud: '1',
        numOficio: '1',
        fechaOficio: '2026-08-03',
        numOficioSupervisor: 'su1',
        fechaOficioSupervisor: '2026-08-03',
        numOficioOrdenador: 'oc1',
        fechaOficioOrdenador: '2026-08-03'
      },
      fechaInicio: '2025-03-01',
      fechaFin: '2025-03-20',
      motivo: 'Fuerza mayor',
      fechaInicioSuspension: '2025-03-01',
      fechaFinSuspension: '2025-03-20',
      fechaReinicio: '2025-03-21',
      adicion: { activa: true, numCdp: '1', vigencia: '2025', valorAdicional: 1000, fechaAdicion: '2025-12-22' },
      prorroga: { activa: true, tiempoDias: 10, fechaProrroga: '2025-12-22' },
      cesionario: { name: 'CESIONARIO', documentNumber: '80038553', documentType: 'CÉDULA DE CIUDADANÍA' },
      cedulaCesionario: '80038553',
      fechaSesion: '2025-12-01',
      fechaTerminacionCedente: '2025-11-30',
      valorDesembolsado: 10,
      valorFavorCedente: 5,
      diasFaltantes: 3,
      fechaTerminacion: '2025-06-30',
      fechaCertificacion: '2025-06-25',
      saldoFavorContratista: 5,
      saldoFavorUniversidad: 5,
      considerando: { activo: false, posicion: null, texto: '' },
      clausula: { activa: false, posicion: null, texto: '' }
    } as unknown as NoveltyDraft;
  }

  function generar(type: NoveltyType): { doc?: NoveltyDocument; error?: unknown } {
    const resultado: { doc?: NoveltyDocument; error?: unknown } = {};
    service.generarActa(contract, draftDe(type)).subscribe({
      next: doc => (resultado.doc = doc),
      error: (e: unknown) => (resultado.error = e)
    });
    return resultado;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpActaMidService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(HttpActaMidService);
    mock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => mock.verify());

  it('cada tipo de novedad va a su propia ruta', () => {
    const rutas: [NoveltyType, string][] = [
      [NoveltyType.SUSPENSION, 'v1/actas/suspension'],
      [NoveltyType.RESTART, 'v1/actas/reinicio'],
      [NoveltyType.ADDITION_EXTENSION, 'v1/actas/adicion-prorroga'],
      [NoveltyType.ASSIGNMENT, 'v1/actas/cesion'],
      [NoveltyType.EARLY_TERMINATION, 'v1/actas/terminacion-liquidacion']
    ];
    for (const [tipo, ruta] of rutas) {
      generar(tipo);
      const req = mock.expectOne(r => r.url.endsWith(ruta));
      expect(req.request.method).toBe('POST');
      req.flush({ success: true, filename: 'acta.pdf', file_base64: 'JVBERi0x' });
    }
  });

  it('devuelve el documento con el nombre que da el servicio', () => {
    const r = generar(NoveltyType.SUSPENSION);
    mock.expectOne(() => true).flush({ filename: 'acta_suspension_653.pdf', file_base64: 'JVBERi0x' });

    expect(r.doc).toEqual({ fileName: 'acta_suspension_653.pdf', mimeType: 'application/pdf', base64: 'JVBERi0x' });
  });

  it('un 200 sin documento es un error, no un acta vacía', () => {
    const r = generar(NoveltyType.SUSPENSION);
    mock.expectOne(() => true).flush({ success: true });

    expect(r.doc).toBeUndefined();
    expect(String(r.error)).toContain('sin el documento');
  });

  it('el 422 de FastAPI llega a la pantalla como el motivo real', () => {
    const r = generar(NoveltyType.EARLY_TERMINATION);
    mock.expectOne(() => true).flush(
      { detail: [{ loc: ['body'], msg: 'Value error, el balance no cuadra: desembolsado + saldos = 35000000', type: 'value_error' }] },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    // El error viaja crudo; `describeApiError` es quien lo traduce para la vista.
    const info = describeApiError(r.error);
    expect(info.code).toBe('422-DATOS');
    expect(info.detail).toBe('el balance no cuadra: desembolsado + saldos = 35000000');
    expect(info.origen).toContain('v1/actas/terminacion-liquidacion');
  });

  it('un tipo sin plantilla no llega a pedir nada al servicio', () => {
    const r = generar(NoveltyType.EXTENSION);
    mock.expectNone(() => true);
    expect(String(r.error)).toContain('No hay plantilla de acta');
  });
});
