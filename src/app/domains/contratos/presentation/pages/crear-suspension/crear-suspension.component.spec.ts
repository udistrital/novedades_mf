import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CrearSuspensionComponent } from './crear-suspension.component';
import { ContractStateService } from '../../../application/contract-state.service';
import { NoveltyService } from '../../../application/novelty.service';
import { ActaGeneratorService } from '../../../application/acta-generator.service';
import { Contract } from '../../../domain/models/contract.entity';

/**
 * El período de la suspensión: el fin nunca puede quedar antes del inicio (ni el
 * mismo día — el mínimo es un día). Es la regla que el usuario puede romper con el
 * calendario del navegador, así que el formulario tiene que rechazarla él mismo.
 */
describe('CrearSuspensionComponent — período de la suspensión', () => {
  const contract = {
    id: '653_2025',
    number: '653',
    startDate: '07/02/2025',
    initialTerm: 'DIEZ ( 10 ) MESES Y QUINCE ( 15 ) DÍAS',
    novelties: []
  } as unknown as Contract;

  let pagina: CrearSuspensionComponent;

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
    pagina = TestBed.runInInjectionContext(() => new CrearSuspensionComponent());
  });

  function fechas(inicio: string, fin: string) {
    pagina.form.controls.fechaInicio.setValue(inicio);
    pagina.form.controls.fechaFin.setValue(fin);
    return pagina.form.controls;
  }

  it('rechaza un fin anterior al inicio, en los dos campos', () => {
    const { fechaInicio, fechaFin } = fechas('2025-03-10', '2025-03-05');

    expect(fechaFin.errors?.['dateRange']).toBeTruthy();
    expect(fechaInicio.errors?.['dateRange']).toBeTruthy();
    expect(pagina.form.valid).toBeFalse();
  });

  it('rechaza el mismo día: el período mínimo es de un día', () => {
    expect(fechas('2025-03-10', '2025-03-10').fechaFin.errors?.['dateRange']).toBeTruthy();
  });

  it('acepta un período válido y deriva período y reinicio', () => {
    const { fechaFin, periodoDias, fechaReinicio } = fechas('2025-02-10', '2025-03-05');

    expect(fechaFin.errors).toBeNull();
    // Regla del negocio: mes = 30 días y ambos extremos incluidos.
    expect(periodoDias.value).toBe(26);
    expect(fechaReinicio.value).toBe('2025-03-06');
  });

  it('vuelve a ser válido al corregir el fin, sin dejar el error pegado', () => {
    fechas('2025-03-10', '2025-03-05');
    const { fechaInicio, fechaFin } = fechas('2025-03-10', '2025-03-20');

    expect(fechaFin.errors).toBeNull();
    expect(fechaInicio.errors).toBeNull();
  });
});
