import { toNoveltySummaries, toContractStatus } from './contract.mapper';
import { NoveltyStatus } from '../../domain/models/novelty-type.enum';
import { ContractStatus } from '../../domain/models/contract-status.enum';
import { ContratoEstadoDto, NovedadMidDto } from '../dtos/external-api.dto';

function novedad(overrides: Partial<NovedadMidDto>): NovedadMidDto {
  return { Id: 1, TipoNovedad: 6, FechaExpedicion: '2024-01-01', Estado: 'En ejecucion', ...overrides };
}

describe('toNoveltySummaries', () => {
  it('ordena por Id descendente (la más reciente primero)', () => {
    const result = toNoveltySummaries([novedad({ Id: 1 }), novedad({ Id: 3 }), novedad({ Id: 2 })]);
    expect(result.map(n => n.id)).toEqual(['3', '2', '1']);
  });

  it('toma el estado de NombreEstado, no de Estado', () => {
    const result = toNoveltySummaries([novedad({ Estado: 'En ejecucion', NombreEstado: 'Terminada' })]);
    expect(result[0].status).toBe(NoveltyStatus.FINISHED);
  });

  it('lee el cesionario aunque la novedad venga anidada en NovedadPoscontractual', () => {
    const anidada: NovedadMidDto = { Id: 9, NovedadPoscontractual: novedad({ Id: 9, TipoNovedad: 2, Cesionario: 10 }) };
    const result = toNoveltySummaries([anidada]);
    expect(result[0].cesionarioId).toBe('10');
  });
});

describe('toContractStatus', () => {
  function estado(nombreEstado: string): ContratoEstadoDto[] {
    return [{ Id: 1, NombreEstado: nombreEstado }];
  }

  it('"Finalizado(Anticipado)" es TERMINADO, no FINALIZADO (contiene "FINALIZADO" como substring)', () => {
    expect(toContractStatus(estado('Finalizado(Anticipado)'))).toBe(ContractStatus.TERMINADO);
  });

  it('"Por Suscribir" (nombre real, no "Inicio") mapea a INICIO', () => {
    expect(toContractStatus(estado('Por Suscribir'))).toBe(ContractStatus.INICIO);
  });

  it('reconoce Anulado y Liquidado', () => {
    expect(toContractStatus(estado('Anulado'))).toBe(ContractStatus.ANULADO);
    expect(toContractStatus(estado('Liquidado'))).toBe(ContractStatus.LIQUIDADO);
  });
});
