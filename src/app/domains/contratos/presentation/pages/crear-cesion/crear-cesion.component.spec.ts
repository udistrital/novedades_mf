import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { CrearCesionComponent } from './crear-cesion.component';
import { ContractStateService } from '../../../application/contract-state.service';
import { NoveltyService } from '../../../application/novelty.service';
import { ActaGeneratorService } from '../../../application/acta-generator.service';
import { Contract } from '../../../domain/models/contract.entity';
import { addDaysToDate, todayIso } from '../../../../../shared/util/format.util';

/** El cedente termina siempre un día antes de la fecha de cesión. */
describe('CrearCesionComponent — terminación del cedente', () => {
  const contract = {
    id: '653_2025',
    number: '653',
    startDate: '07/02/2025',
    initialTerm: 'DIEZ ( 10 ) MESES Y QUINCE ( 15 ) DÍAS',
    novelties: []
  } as unknown as Contract;

  let pagina: CrearCesionComponent;

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
    pagina = TestBed.runInInjectionContext(() => new CrearCesionComponent());
  });

  it('se deriva al cambiar la fecha de cesión', () => {
    pagina.form.controls.fechaSesion.setValue('2025-03-01');

    expect(pagina.form.controls.fechaTerminacionCedente.value).toBe('2025-02-28');
  });

  it('Limpiar la vuelve a derivar de la fecha de cesión por defecto', () => {
    pagina.form.controls.fechaSesion.setValue('2025-03-01');
    pagina.onClear();

    expect(pagina.form.controls.fechaTerminacionCedente.value).toBe(addDaysToDate(todayIso(), -1));
  });
});
