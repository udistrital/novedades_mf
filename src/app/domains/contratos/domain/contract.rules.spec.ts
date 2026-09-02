import { Contract, NoveltySummary } from './models/contract.entity';
import { ContractAction, ContractStatus } from './models/contract-status.enum';
import { NoveltyStatus, NoveltyType } from './models/novelty-type.enum';
import {
  availableActions,
  canAnnulNovelty,
  canManageContract,
  contractEndDate,
  contractStatusLabel,
  currentContractValue,
  currentContractorId,
  currentTermDays,
  effectiveStatus,
  hasNoveltyInProgress,
  maxAdditionValue,
  maxEarlyTerminationDate,
  maxExtensionDays,
  terminationImbalance
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
    principalId: '16387',
    number: '123',
    contractorProviderId: '193',
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

    it('una cesión sin póliza deja el contrato pendiente de póliza, aunque Ágora diga otra cosa', () => {
      // Ágora sigue reportando "En ejecución": la cesión no registra cambio de estado
      // y ese estado ni siquiera existe en su catálogo. Solo se deriva de la novedad.
      const c = contract({
        status: ContractStatus.EN_EJECUCION,
        novelties: [novelty({ type: NoveltyType.ASSIGNMENT })]
      });
      expect(effectiveStatus(c)).toBe(ContractStatus.CESION_PENDIENTE_POLIZA);
      expect(availableActions(c)).toEqual([ContractAction.AGREGAR_POLIZA]);
    });

    it('con la póliza ya registrada el contrato vuelve a su estado normal', () => {
      const c = contract({
        status: ContractStatus.EN_EJECUCION,
        novelties: [novelty({ type: NoveltyType.ASSIGNMENT, numeroPoliza: 'Pol123' })]
      });
      expect(effectiveStatus(c)).toBe(ContractStatus.EN_EJECUCION);
      expect(availableActions(c).length).toBe(4);
    });

    it('una suspensión posterior manda sobre la cesión ya cerrada', () => {
      const c = contract({
        novelties: [
          novelty({ id: '1', type: NoveltyType.ASSIGNMENT, numeroPoliza: 'Pol123' }),
          novelty({ id: '2', type: NoveltyType.SUSPENSION })
        ]
      });
      expect(effectiveStatus(c)).toBe(ContractStatus.SUSPENDIDO);
    });
  });

  /**
   * La liquidación reparte el contrato completo: lo ya pagado (desembolsado), lo
   * ejecutado y aún no pagado (saldo del contratista) y lo no ejecutado, que vuelve a
   * la universidad. El servicio de actas rechaza el documento si no suman.
   */
  describe('terminationImbalance', () => {
    const c = contract({ totalValue: 60_000_000 });

    it('cuadra cuando los tres reparten el valor vigente', () => {
      expect(terminationImbalance(c, 20_000_000, 10_000_000, 30_000_000)).toBe(0);
    });

    it('los tres pueden ser mayores que cero a la vez', () => {
      // No son excluyentes: el contratista puede tener saldo pendiente y la
      // universidad recuperar lo no ejecutado en la misma liquidación.
      expect(terminationImbalance(c, 20_000_000, 10_000_000, 25_000_000)).toBe(5_000_000);
    });

    it('devuelve negativo cuando se reparte de más', () => {
      expect(terminationImbalance(c, 50_000_000, 10_000_000, 5_000_000)).toBe(-5_000_000);
    });

    it('cuenta las adiciones: el tope es el valor vigente, no el inicial', () => {
      const conAdicion = contract({
        totalValue: 60_000_000,
        novelties: [novelty({ valorAdicion: 10_000_000 })]
      });
      expect(terminationImbalance(conAdicion, 70_000_000, 0, 0)).toBe(0);
    });

    it('trata los campos vacíos como cero', () => {
      expect(terminationImbalance(c, null, undefined, null)).toBe(60_000_000);
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
      const vieja = novelty({ id: '1', expeditionDate: '01/01/2024' });
      const ultima = novelty({ id: '2', expeditionDate: '01/03/2024' });
      const c = contract({ novelties: [vieja, ultima] });
      expect(canAnnulNovelty(c, vieja)).toBeFalse();
      expect(canAnnulNovelty(c, ultima)).toBeTrue();
    });

    it('con la misma fecha de expedición, gana el id más alto (no el orden del arreglo)', () => {
      // `contract.novelties` llega del mapper ya ordenado por id descendente (más
      // reciente primero): si "última" se decidiera por fecha con empate, el
      // desempate por orden de iteración terminaría eligiendo la más antigua.
      const reciente = novelty({ id: '3', expeditionDate: '01/01/2024' });
      const vieja = novelty({ id: '1', expeditionDate: '01/01/2024' });
      const c = contract({ novelties: [reciente, vieja] });
      expect(canAnnulNovelty(c, reciente)).toBeTrue();
      expect(canAnnulNovelty(c, vieja)).toBeFalse();
    });

    it('la cesión es anulable mientras está pendiente de póliza', () => {
      const cesion = novelty({ id: '2', type: NoveltyType.ASSIGNMENT });
      expect(canAnnulNovelty(contract({ novelties: [cesion] }), cesion)).toBeTrue();
    });

    it('con la póliza ya registrada, la cesión deja de ser anulable', () => {
      // La anulación existe para revertir errores. Registrar la póliza cierra el
      // trámite: quien cedió y luego aseguró no está corrigiendo nada.
      const cesion = novelty({ id: '2', type: NoveltyType.ASSIGNMENT, numeroPoliza: 'Pol123' });
      const c = contract({ status: ContractStatus.EN_EJECUCION, novelties: [cesion] });
      expect(canAnnulNovelty(c, cesion)).toBeFalse();
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

  describe('contractStatusLabel', () => {
    it('muestra "Terminado (Anticipado)" para el estado Terminado', () => {
      expect(contractStatusLabel(ContractStatus.TERMINADO)).toBe('Terminado (Anticipado)');
    });

    it('muestra "Sin acta de inicio" para Suscrito y el resto sin cambios', () => {
      expect(contractStatusLabel(ContractStatus.SUSCRITO)).toBe('Sin acta de inicio');
      expect(contractStatusLabel(ContractStatus.EN_EJECUCION)).toBe('En ejecución');
      expect(contractStatusLabel(ContractStatus.FINALIZADO)).toBe('Finalizado');
    });
  });

  describe('contractEndDate', () => {
    it('usa la FechaFin del acta, no el plazo, cuando el acta está cargada', () => {
      // El plazo daría 27/10/2024; el acta manda y dice 21/12/2024.
      const c = contract({ startDate: '01/01/2024', initialTerm: 'DIEZ ( 10 ) MESES', endDate: '21/12/2024' });
      expect(contractEndDate(c)).toBe('2024-12-21');
    });

    it('suma las prórrogas históricas sobre la fecha del acta (el acta no las incluye)', () => {
      const c = contract({
        endDate: '21/12/2024',
        novelties: [novelty({ id: '1', type: NoveltyType.EXTENSION, diasProrroga: 12 })]
      });
      expect(contractEndDate(c)).toBe('2025-01-02');
    });

    it('sin acta cae a la aproximación por plazo vigente', () => {
      const c = contract({ startDate: '01/01/2024', initialTerm: 'DIEZ ( 10 ) MESES' });
      expect(contractEndDate(c)).toBe('2024-10-27');
    });

    it('las suspensiones también corren el fin (el acta tampoco las refleja)', () => {
      const c = contract({
        endDate: '21/12/2024',
        novelties: [novelty({ id: '1', type: NoveltyType.SUSPENSION, diasSuspension: 26 })]
      });
      expect(contractEndDate(c)).toBe('2025-01-16');
    });

    it('un reinicio no suma días: ya están contados en la suspensión que reanuda', () => {
      const c = contract({
        endDate: '21/12/2024',
        novelties: [
          novelty({ id: '1', type: NoveltyType.SUSPENSION, diasSuspension: 26 }),
          novelty({ id: '2', type: NoveltyType.RESTART })
        ]
      });
      expect(contractEndDate(c)).toBe('2025-01-16');
    });

    it('los días de suspensión no cuentan para el plazo de ejecución (solo lo pausan)', () => {
      const c = contract({
        initialTerm: 'DIEZ ( 10 ) MESES',
        novelties: [novelty({ id: '1', type: NoveltyType.SUSPENSION, diasSuspension: 26 })]
      });
      expect(currentTermDays(c)).toBe(300);
    });
  });

  describe('maxEarlyTerminationDate', () => {
    it('es un día antes del fin vigente del contrato', () => {
      const c = contract({ endDate: '21/12/2024' });
      expect(maxEarlyTerminationDate(c)).toBe('2024-12-20');
    });

    it('las prórrogas históricas corren el tope hacia adelante', () => {
      const c = contract({
        endDate: '21/12/2024',
        novelties: [novelty({ id: '1', type: NoveltyType.EXTENSION, diasProrroga: 30 })]
      });
      expect(maxEarlyTerminationDate(c)).toBe('2025-01-19');
    });
  });

  describe('currentContractorId (§5.5)', () => {
    it('devuelve el id del último cesionario cuando hubo cesiones', () => {
      const c = contract({
        novelties: [
          novelty({ id: '1', type: NoveltyType.ASSIGNMENT, expeditionDate: '01/02/2024', cesionarioId: '222' }),
          novelty({ id: '2', type: NoveltyType.ASSIGNMENT, expeditionDate: '01/04/2024', cesionarioId: '333' })
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
