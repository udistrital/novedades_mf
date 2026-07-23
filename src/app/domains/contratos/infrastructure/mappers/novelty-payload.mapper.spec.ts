import { toNoveltyPayload } from './novelty-payload.mapper';
import { NoveltyType } from '../../domain/models/novelty-type.enum';
import { TerminacionDraft } from '../../domain/models/novelty-draft.model';

function terminacionDraft(): TerminacionDraft {
  return {
    type: NoveltyType.EARLY_TERMINATION,
    solicitud: {
      fechaSolicitud: '2026-07-20',
      fechaExpedicionActa: '2026-07-21',
      numOficioSupervisor: '123',
      fechaOficioSupervisor: '2026-07-20',
      numOficioOrdenador: '123',
      fechaOficioOrdenador: '2026-07-20'
    },
    fechaTerminacion: '2026-10-27',
    fechaCertificacion: '2026-10-28',
    valorDesembolsado: 100,
    saldoFavorContratista: 1000,
    saldoFavorUniversidad: 4,
    clausula: { activa: false, posicion: null, texto: '' }
  };
}

describe('toNoveltyPayload — EARLY_TERMINATION', () => {
  it('arma el body plano confirmado contra la traza real del mid (POST novedad/)', () => {
    const payload = toNoveltyPayload(terminacionDraft(), '435', '2022', 'CC123456789');

    expect(payload['contrato']).toBe('435');
    expect(payload['vigencia']).toBe('2022');
    expect(payload['tiponovedad']).toBe('NP_TER');
    expect(payload['estado']).toBe('TERM');
    expect(payload['fecha_terminacion_anticipada']).toBe('2026-10-27');
    // Mismo valor que fecha_terminacion_anticipada: la traza no distingue fechaCertificacion.
    expect(payload['fechafinefectiva']).toBe('2026-10-27');
    expect(payload['valor_desembolsado']).toBe(100);
    expect(payload['saldo_contratista']).toBe(1000);
    expect(payload['saldo_universidad']).toBe(4);
    expect(payload['enlace']).toBe('');
    expect(payload['usuario']).toBeUndefined();
    expect(payload['numeroContrato']).toBeUndefined();
  });
});
