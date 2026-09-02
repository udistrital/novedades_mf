import { toNoveltySummaries, toContract, toContractStatus, ordenadorGastoId } from './contract.mapper';
import { NoveltyStatus } from '../../domain/models/novelty-type.enum';
import { ContractStatus } from '../../domain/models/contract-status.enum';
import { ContratoEstadoDto, ContratoGeneralDto, NovedadMidDto } from '../dtos/external-api.dto';

function novedad(overrides: Partial<NovedadMidDto>): NovedadMidDto {
  return { Id: 1, TipoNovedad: 6, FechaExpedicion: '2024-01-01', Estado: 'En ejecucion', ...overrides };
}

/**
 * Ágora guarda el plazo en la unidad con que se pactó cada contrato, y así llegaba a
 * la vista: dos contratos de la misma duración se leían distinto. Aquí se normaliza una
 * sola vez, y de aquí sale el plazo que muestran la tarjeta, los resúmenes y las actas.
 */
describe('toContract — plazo en meses y días', () => {
  function plazoDe(PlazoEjecucion: number, unidad: string): string {
    const row = { PlazoEjecucion, UnidadEjecucion: { Nombre: unidad } } as unknown as ContratoGeneralDto;
    return toContract(row, null, []).initialTerm;
  }

  it('convierte el plazo pactado en días', () => {
    expect(plazoDe(315, 'Dia(s)')).toBe('DIEZ ( 10 ) MESES Y QUINCE ( 15 ) DÍAS');
    // Menos de un mes conserva la parte de meses en cero, no la omite.
    expect(plazoDe(24, 'Dia(s)')).toBe('CERO ( 0 ) MESES Y VEINTICUATRO ( 24 ) DÍAS');
  });

  it('deja el plazo pactado en meses como meses exactos', () => {
    expect(plazoDe(9, 'Mes(es)')).toBe('NUEVE ( 9 ) MESES');
    // Sin unidad se asumen meses, como antes de normalizar.
    expect(plazoDe(3, '')).toBe('TRES ( 3 ) MESES');
  });
});

describe('toNoveltySummaries', () => {
  it('ordena por Id descendente (la más reciente primero)', () => {
    const result = toNoveltySummaries([novedad({ Id: 1 }), novedad({ Id: 3 }), novedad({ Id: 2 })]);
    expect(result.map(n => n.id)).toEqual(['3', '2', '1']);
  });

  it('toma el estado de NombreEstado, no de Estado', () => {
    const result = toNoveltySummaries([novedad({ Estado: 'En ejecucion', NombreEstado: 'Terminada' })]);
    expect(result[0].status).toBe(NoveltyStatus.FINISHED);
  });

  it('lee el período real de una suspensión, no la expedición del acta', () => {
    const [s] = toNoveltySummaries([
      novedad({
        TipoNovedad: 1,
        FechaExpedicion: '2026-07-26',
        FechaSuspension: '2025-02-10',
        FechaFinSuspension: '2025-03-05',
        PeriodoSuspension: 26
      })
    ]);
    expect(s.expeditionDate).toBe('26/07/2026');
    expect(s.effectiveDate).toBe('10/02/2025');
    expect(s.effectiveEndDate).toBe('05/03/2025');
    expect(s.diasSuspension).toBe(26);
    // Los días de una suspensión no deben leerse como prórroga.
    expect(s.diasProrroga).toBeUndefined();
  });

  it('lee el cesionario aunque la novedad venga anidada en NovedadPoscontractual', () => {
    const anidada: NovedadMidDto = { Id: 9, NovedadPoscontractual: novedad({ Id: 9, TipoNovedad: 2, Cesionario: 10 }) };
    const result = toNoveltySummaries([anidada]);
    expect(result[0].cesionarioId).toBe('10');
  });

  /**
   * Los nombres salen de `novedades_mid/models/*.go`, donde las cinco `GetNovedad*`
   * arman el mismo mapa. Si el mapper lee otro nombre, el valor y el plazo vigentes
   * caen a 0 **sin avisar**, y con ellos los topes del 50 %.
   */
  it('lee los nombres reales del mid: ValorAdicion, TiempoProrroga y Poliza', () => {
    const [adicion] = toNoveltySummaries([
      novedad({ TipoNovedad: 6, ValorAdicion: 1_500_000, TiempoProrroga: 30 })
    ]);
    expect(adicion.valorAdicion).toBe(1_500_000);
    expect(adicion.diasProrroga).toBe(30);

    const [cesion] = toNoveltySummaries([novedad({ TipoNovedad: 2, Poliza: 'Pol123' })]);
    expect(cesion.numeroPoliza).toBe('Pol123');
  });

  it('el enlace del acta llega como `Enlace` (mid) o `EnlaceDocumento` (fila del CRUD)', () => {
    expect(toNoveltySummaries([novedad({ Enlace: 'uuid-mid' })])[0].documentId).toBe('uuid-mid');
    const anidada: NovedadMidDto = {
      Id: 7,
      NovedadPoscontractual: { Id: 7, TipoNovedad: 6, EnlaceDocumento: 'uuid-crud' }
    };
    expect(toNoveltySummaries([anidada])[0].documentId).toBe('uuid-crud');
  });

  it('marca como no anulable la novedad que ya viene desactivada', () => {
    const [s] = toNoveltySummaries([novedad({ Id: 4, Activo: false })]);
    expect(s.canAnnul).toBeFalse();
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

describe('ordenadorGastoId', () => {
  it('devuelve el id cuando el contrato trae un número', () => {
    expect(ordenadorGastoId({ OrdenadorGasto: 1035 })).toBe(1035);
  });

  it('es undefined solo cuando no hay ordenador asignado', () => {
    expect(ordenadorGastoId({ OrdenadorGasto: null })).toBeUndefined();
    expect(ordenadorGastoId({})).toBeUndefined();
    expect(ordenadorGastoId({ OrdenadorGasto: 0 })).toBeUndefined();
  });

  it('acepta la variante como objeto con Id', () => {
    expect(ordenadorGastoId({ OrdenadorGasto: { Id: 1035 } })).toBe(1035);
  });
});
