import { Contract, NoveltySummary } from './models/contract.entity';
import { ContractAction, ContractStatus } from './models/contract-status.enum';
import { NoveltyStatus, NoveltyType } from './models/novelty-type.enum';
import {
  availableActions,
  canAnnulNovelty,
  canManageContract,
  currentContractValue,
  currentContractorId,
  currentTermDays,
  effectiveStatus,
  hasNoveltyInProgress,
  maxAdditionValue,
  maxExtensionDays
} from './contract.rules';

function novelty(overrides: Partial<NoveltySummary>): NoveltySummary {
  return {
    id: 'n1',
    type: NoveltyType.ADDITION_EXTENSION,
    expeditionDate: '01/02/2024',
    status: NoveltyStatus.IN_EXECUTION,
    canAnnul: true,
    ...overrides
  };
}

function contract(overrides: Partial<Contract>): Contract {
  return {
    id: '123_2024',
    number: '123',
    contractType: 'Prestación de servicios',
    contractorName: 'CONTRATISTA ORIGINAL',
    contractorId: '111',
    contractingEntity: 'UD',
    totalValue: 100_000_000,
    object: '—',
    initialTerm: 'DIEZ ( 10 ) MESES',
    startDate: '01/01/2024',
    supervisor: 'SUPERVISORA',
    supervisorDocument: '52045004',
    spendingManager: 'ORDENADOR',
    novelties: [],
    ...overrides
  };
}

describe('contract.rules', () => {
  describe('effectiveStatus', () => {
    it('prioriza el estado real del backend', () => {
      expect(effectiveStatus(contract({ status: ContractStatus.CANCELADO }))).toBe(ContractStatus.CANCELADO);
    });

    it('sin estado del backend infiere Suspendido por la última novedad', () => {
      const c = contract({ novelties: [novelty({ type: NoveltyType.SUSPENSION })] });
      expect(effectiveStatus(c)).toBe(ContractStatus.SUSPENDIDO);
    });

    it('sin estado ni suspensión asume En ejecución', () => {
      expect(effectiveStatus(contract({}))).toBe(ContractStatus.EN_EJECUCION);
    });
  });

  describe('availableActions (mapa estado → acciones §5.1)', () => {
    it('En ejecución habilita las 4 novedades', () => {
      expect(availableActions(contract({ status: ContractStatus.EN_EJECUCION }))).toEqual([
        ContractAction.ADICION_PRORROGA,
        ContractAction.SUSPENSION,
        ContractAction.CESION,
        ContractAction.TERMINACION
      ]);
    });

    it('Suspendido solo habilita Reinicio', () => {
      expect(availableActions(contract({ status: ContractStatus.SUSPENDIDO }))).toEqual([ContractAction.REINICIO]);
    });

    it('Cesión pendiente de póliza solo habilita Agregar póliza', () => {
      expect(availableActions(contract({ status: ContractStatus.CESION_PENDIENTE_POLIZA })))
        .toEqual([ContractAction.AGREGAR_POLIZA]);
    });

    it('Finalizado solo habilita Activar contrato', () => {
      expect(availableActions(contract({ status: ContractStatus.FINALIZADO })))
        .toEqual([ContractAction.ACTIVAR_CONTRATO]);
    });

    it('Cancelado / Inicio / Terminado no habilitan nada', () => {
      for (const status of [ContractStatus.CANCELADO, ContractStatus.INICIO, ContractStatus.TERMINADO]) {
        expect(availableActions(contract({ status }))).toEqual([]);
      }
    });

    it('una novedad En trámite bloquea todas las acciones (§5.1)', () => {
      const c = contract({
        status: ContractStatus.EN_EJECUCION,
        novelties: [novelty({ status: NoveltyStatus.IN_PROCESS })]
      });
      expect(availableActions(c)).toEqual([]);
      expect(hasNoveltyInProgress(c)).toBeTrue();
    });
  });

  describe('canAnnulNovelty (condiciones estrictas §5.1)', () => {
    it('solo la última novedad es anulable', () => {
      const vieja = novelty({ id: 'n1', expeditionDate: '01/01/2024' });
      const ultima = novelty({ id: 'n2', expeditionDate: '01/03/2024' });
      const c = contract({ novelties: [vieja, ultima] });
      expect(canAnnulNovelty(c, vieja)).toBeFalse();
      expect(canAnnulNovelty(c, ultima)).toBeTrue();
    });

    it('el tipo debe corresponder al estado: Suspensión anulable solo con contrato Suspendido', () => {
      const suspension = novelty({ type: NoveltyType.SUSPENSION });
      const c = contract({ status: ContractStatus.SUSPENDIDO, novelties: [suspension] });
      expect(canAnnulNovelty(c, suspension)).toBeTrue();

      const cCancelado = contract({ status: ContractStatus.CANCELADO, novelties: [suspension] });
      expect(canAnnulNovelty(cCancelado, suspension)).toBeFalse();
    });
  });

  describe('acumulados (§5.1/§5.2)', () => {
    const c = contract({
      totalValue: 100_000_000,
      initialTerm: 'DIEZ ( 10 ) MESES',
      novelties: [
        novelty({ id: 'a1', valorAdicion: 20_000_000 }),
        novelty({ id: 'p1', type: NoveltyType.EXTENSION, diasProrroga: 60 })
      ]
    });

    it('el valor vigente suma las adiciones históricas', () => {
      expect(currentContractValue(c)).toBe(120_000_000);
    });

    it('el plazo vigente suma las prórrogas históricas (mes = 30 días)', () => {
      expect(currentTermDays(c)).toBe(360);
    });

    it('los topes del 50 % se calculan sobre los acumulados', () => {
      expect(maxAdditionValue(c)).toBe(60_000_000);
      expect(maxExtensionDays(c)).toBe(180);
    });
  });

  describe('currentContractorId (§5.5)', () => {
    it('devuelve el id del último cesionario cuando hubo cesiones', () => {
      const c = contract({
        novelties: [
          novelty({ id: 'c1', type: NoveltyType.ASSIGNMENT, expeditionDate: '01/02/2024', cesionarioId: '222' }),
          novelty({ id: 'c2', type: NoveltyType.ASSIGNMENT, expeditionDate: '01/04/2024', cesionarioId: '333' })
        ]
      });
      expect(currentContractorId(c)).toBe('333');
    });

    it('sin cesiones devuelve undefined (se mantiene el contratista original)', () => {
      expect(currentContractorId(contract({}))).toBeUndefined();
    });
  });

  describe('canManageContract (regla de rol §4)', () => {
    const c = contract({ supervisorDocument: '52045004' });

    it('un SUPERVISOR (único rol) solo gestiona el contrato que supervisa', () => {
      expect(canManageContract(['SUPERVISOR'], '52045004', c)).toBeTrue();
      expect(canManageContract(['SUPERVISOR'], '99999999', c)).toBeFalse();
    });

    it('otros roles de negocio no están sujetos a la coincidencia de documento', () => {
      expect(canManageContract(['ORDENADOR_DEL_GASTO'], '99999999', c)).toBeTrue();
      expect(canManageContract(['SUPERVISOR', 'ASISTENTE_JURIDICA'], '99999999', c)).toBeTrue();
    });
  });
});
