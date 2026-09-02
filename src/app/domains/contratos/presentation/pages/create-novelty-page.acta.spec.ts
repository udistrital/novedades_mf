import { Directive } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CreateNoveltyPage } from './create-novelty-page.base';
import { ContractStateService } from '../../application/contract-state.service';
import { NoveltyService } from '../../application/novelty.service';
import { ActaGeneratorService } from '../../application/acta-generator.service';
import { NoveltyDraft } from '../../domain/models/novelty-draft.model';
import { NoveltyType } from '../../domain/models/novelty-type.enum';
import { Contract } from '../../domain/models/contract.entity';
import { NoveltyDocument } from '../../domain/models/novelty-document.model';

/**
 * La garantía de [ADR-018](../../../../../docs/adr/ADR-018-acta-antes-de-la-novedad.md):
 * **el acta se genera antes de escribir nada**, así que si no se puede producir el
 * documento que formaliza la novedad, la novedad no se registra.
 *
 * Se prueba sobre la clase base y no sobre una página concreta: no hay plantilla de
 * por medio: es orquestación pura (el `switchMap` que encadena acta → creación), que
 * es justo lo que un cambio descuidado podría invertir sin que nada más lo note.
 */
@Directive()
class PaginaDePrueba extends CreateNoveltyPage {
  readonly noveltyName = 'Suspensión';
  readonly form = new FormGroup({});
  protected buildDraft(): NoveltyDraft {
    return { type: NoveltyType.SUSPENSION } as unknown as NoveltyDraft;
  }
  protected buildSummary() {
    return [];
  }
}

describe('CreateNoveltyPage — el acta va antes de la novedad', () => {
  const acta: NoveltyDocument = { fileName: 'acta.pdf', mimeType: 'application/pdf', base64: 'JVBERi0x' };
  const contract = { id: '653_2025', number: '653' } as unknown as Contract;

  let pagina: PaginaDePrueba;
  let actaGenerator: { generar: jasmine.Spy; descargar: jasmine.Spy; previsualizar: jasmine.Spy };
  let noveltyService: { create: jasmine.Spy };

  beforeEach(() => {
    actaGenerator = {
      generar: jasmine.createSpy('generar').and.returnValue(of(acta)),
      descargar: jasmine.createSpy('descargar'),
      previsualizar: jasmine.createSpy('previsualizar').and.returnValue(of(undefined))
    };
    noveltyService = { create: jasmine.createSpy('create').and.returnValue(of(undefined)) };

    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ contractId: '653_2025' }) } } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate'), navigateByUrl: jasmine.createSpy('navigateByUrl') } },
        { provide: ContractStateService, useValue: { loadContract: () => undefined, selectedContract: () => contract } },
        { provide: NoveltyService, useValue: noveltyService },
        { provide: ActaGeneratorService, useValue: actaGenerator }
      ]
    });
    pagina = TestBed.runInInjectionContext(() => new PaginaDePrueba());
  });

  it('genera el acta y le pasa el PDF a la creación, que es lo que archiva el gestor', () => {
    pagina.onConfirm();

    expect(actaGenerator.generar).toHaveBeenCalledBefore(noveltyService.create);
    expect(noveltyService.create).toHaveBeenCalledWith('653_2025', jasmine.anything(), 'JVBERi0x', false);
    expect(pagina.pageState()).toBe('success');
  });

  it('si el acta falla, la novedad NO se registra', () => {
    actaGenerator.generar.and.returnValue(throwError(() => new Error('El servicio de actas no respondió a tiempo.')));

    pagina.onConfirm();

    expect(noveltyService.create).not.toHaveBeenCalled();
    expect(pagina.pageState()).toBe('error');
    expect(pagina.errorInfo()?.detail).toContain('no respondió a tiempo');
  });

  it('la descarga espera al registro: no se entrega el acta de una novedad que no existe', () => {
    noveltyService.create.and.returnValue(throwError(() => new Error('El servicio rechazó la novedad.')));

    pagina.onConfirm();

    expect(actaGenerator.generar).toHaveBeenCalled();
    expect(actaGenerator.descargar).not.toHaveBeenCalled();
    expect(pagina.pageState()).toBe('error');
  });
});
