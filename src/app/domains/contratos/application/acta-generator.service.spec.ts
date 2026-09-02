import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ActaGeneratorService } from './acta-generator.service';
import { ActaOptions, IActaGenerator } from '../domain/repositories/acta-generator.repository';
import { IContractRepository } from '../domain/repositories/contract.repository';
import { Contract } from '../domain/models/contract.entity';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { NoveltyType } from '../domain/models/novelty-type.enum';
import { NoveltyDocument } from '../domain/models/novelty-document.model';

/**
 * La consulta de CDP/CRP a `financiera_jbpm` es **lenta** y solo la imprimen las
 * actas de suspensión, cesión y terminación. Como el acta se genera antes de
 * registrar la novedad (ADR-018), pagarla en los otros tipos retrasa el trámite
 * entero sin que el documento la use.
 */
describe('ActaGeneratorService — consulta del CDP/CRP', () => {
  const acta: NoveltyDocument = { fileName: 'acta.pdf', mimeType: 'application/pdf', base64: 'aGk=' };
  const contract = { id: '653_2025', number: '653' } as unknown as Contract;

  let service: ActaGeneratorService;
  let repo: { getActaResponsables: jasmine.Spy; getCdpRp: jasmine.Spy };
  let generator: { generarActa: jasmine.Spy };

  /** Opciones con las que se llamó al generador en la última generación. */
  function opciones(): ActaOptions {
    return generator.generarActa.calls.mostRecent().args[2] as ActaOptions;
  }

  function generar(type: NoveltyType): void {
    service.generar(contract, { type } as unknown as NoveltyDraft, 10).subscribe();
  }

  beforeEach(() => {
    repo = {
      getActaResponsables: jasmine.createSpy('getActaResponsables').and.returnValue(
        of({ elaboro: 'Laura Niño', jefeJuridica: 'Ana Torres' })
      ),
      getCdpRp: jasmine.createSpy('getCdpRp').and.returnValue(of({ cdp: '4097', rp: '11238' }))
    };
    generator = { generarActa: jasmine.createSpy('generarActa').and.returnValue(of(acta)) };

    TestBed.configureTestingModule({
      providers: [
        ActaGeneratorService,
        { provide: IContractRepository, useValue: repo },
        { provide: IActaGenerator, useValue: generator }
      ]
    });
    service = TestBed.inject(ActaGeneratorService);
  });

  it('la pide para suspensión, cesión y terminación, que sí imprimen el CDP y el CRP', () => {
    for (const tipo of [NoveltyType.SUSPENSION, NoveltyType.ASSIGNMENT, NoveltyType.EARLY_TERMINATION]) {
      generar(tipo);
      expect(repo.getCdpRp).toHaveBeenCalledWith(contract);
      expect(opciones().cdp).toBe('4097');
      expect(opciones().rp).toBe('11238');
    }
  });

  it('no la pide en los demás tipos, y el acta se genera igual', () => {
    for (const tipo of [NoveltyType.ADDITION_EXTENSION, NoveltyType.RESTART]) {
      generar(tipo);
      expect(opciones().cdp).toBe('');
      // Los firmantes sí se resuelven siempre: esos los imprimen las cinco actas.
      expect(opciones().elaboro).toBe('Laura Niño');
    }
    expect(repo.getCdpRp).not.toHaveBeenCalled();
  });
});
