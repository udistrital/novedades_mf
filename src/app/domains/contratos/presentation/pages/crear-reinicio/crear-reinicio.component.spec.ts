import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CrearReinicioComponent } from './crear-reinicio.component';
import { ContractStateService } from '../../../application/contract-state.service';
import { NoveltyService } from '../../../application/novelty.service';
import { ActaGeneratorService } from '../../../application/acta-generator.service';
import { Contract } from '../../../domain/models/contract.entity';
import { NoveltyType } from '../../../domain/models/novelty-type.enum';

/**
 * El reinicio puede **adelantar** el fin de la suspensión (reiniciar antes de lo
 * previsto), nunca ponerlo antes de que la suspensión empezara: eso da un período
 * negativo, que viajaba tal cual a la novedad y al acta. El campo solo tenía tope
 * superior; el piso es lo que se fija aquí.
 */
describe('CrearReinicioComponent — fin de la suspensión', () => {
  const contract = {
    id: '653_2025',
    number: '653',
    startDate: '07/02/2025',
    initialTerm: 'DIEZ ( 10 ) MESES Y QUINCE ( 15 ) DÍAS',
    novelties: [
      {
        id: '1',
        type: NoveltyType.SUSPENSION,
        expeditionDate: '10/02/2025',
        effectiveDate: '10/02/2025',
        effectiveEndDate: '05/03/2025',
        diasSuspension: 26
      }
    ]
  } as unknown as Contract;

  let pagina: CrearReinicioComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ contractId: '653_2025' }) } } },
        { provide: Router, useValue: { navigate: () => undefined, navigateByUrl: () => undefined } },
        { provide: ContractStateService, useValue: { loadContract: () => undefined, selectedContract: () => contract } },
        { provide: NoveltyService, useValue: { create: () => of(undefined) } },
        { provide: ActaGeneratorService, useValue: { generar: () => of(undefined), descargar: () => undefined, previsualizar: () => of(undefined) } }
      ]
    });
    pagina = TestBed.runInInjectionContext(() => new CrearReinicioComponent());
  });

  /** El inicio es de solo lectura: lo precarga el efecto desde la suspensión vigente. */
  function conFin(fin: string) {
    TestBed.flushEffects();
    pagina.form.controls.fechaFinSuspension.setValue(fin);
    return pagina.form.controls;
  }

  it('rechaza un fin anterior al inicio de la suspensión', () => {
    const { fechaFinSuspension, periodoDias } = conFin('2025-02-01');

    expect(fechaFinSuspension.errors?.['minDate']).toEqual({ min: '2025-02-11' });
    // Sin número negativo a la vista: el período queda en blanco hasta corregir.
    expect(periodoDias.value).toBeNull();
  });

  it('rechaza el mismo día del inicio: el período mínimo es de un día', () => {
    expect(conFin('2025-02-10').fechaFinSuspension.errors?.['minDate']).toBeTruthy();
  });

  it('acepta adelantar el fin dentro del período de la suspensión', () => {
    const { fechaFinSuspension, periodoDias, fechaReinicio } = conFin('2025-02-20');

    expect(fechaFinSuspension.errors).toBeNull();
    expect(periodoDias.value).toBe(11);
    expect(fechaReinicio.value).toBe('2025-02-21');
  });

  it('sigue rechazando un fin posterior al registrado en la suspensión', () => {
    expect(conFin('2025-03-20').fechaFinSuspension.errors?.['maxDate']).toEqual({ max: '2025-03-05' });
  });
});
