import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ActaViewerService } from './acta-viewer.service';
import { IContractRepository } from '../domain/repositories/contract.repository';
import { NoveltyDocument } from '../domain/models/novelty-document.model';

/** Doble de la pestaña que abre el navegador, para no depender de pop-ups reales. */
function fakeTab(): { location: { href: string }; close: jasmine.Spy } {
  return { location: { href: '' }, close: jasmine.createSpy('close') };
}

describe('ActaViewerService', () => {
  let service: ActaViewerService;
  let repo: { getNoveltyDocument: jasmine.Spy<(id: string) => Observable<NoveltyDocument>> };
  let tab: ReturnType<typeof fakeTab>;

  const acta: NoveltyDocument = { fileName: 'acta.pdf', mimeType: 'application/pdf', base64: 'aGk=' };

  beforeEach(() => {
    repo = { getNoveltyDocument: jasmine.createSpy('getNoveltyDocument').and.returnValue(of(acta)) };
    tab = fakeTab();
    spyOn(window, 'open').and.returnValue(tab as unknown as Window);

    TestBed.configureTestingModule({
      providers: [ActaViewerService, { provide: IContractRepository, useValue: repo }]
    });
    service = TestBed.inject(ActaViewerService);
  });

  it('abre la pestaña de inmediato (dentro del gesto) y luego la lleva al documento', () => {
    service.open('uuid-1').subscribe();
    // La pestaña se pide antes de resolver la descarga: si se abriera después, el
    // bloqueador de pop-ups la descartaría.
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(tab.location.href).toMatch(/^blob:/);
  });

  it('cachea el acta: el segundo acceso no vuelve a pedirla al backend', () => {
    service.open('uuid-1').subscribe();
    expect(service.isCached('uuid-1')).toBeTrue();

    service.open('uuid-1').subscribe();
    expect(repo.getNoveltyDocument).toHaveBeenCalledTimes(1);
  });

  it('cada acta se cachea por su propio id', () => {
    service.open('uuid-1').subscribe();
    service.open('uuid-2').subscribe();
    expect(repo.getNoveltyDocument).toHaveBeenCalledTimes(2);
    expect(service.isCached('uuid-2')).toBeTrue();
  });

  it('cierra la pestaña y propaga el error si la descarga falla', () => {
    repo.getNoveltyDocument.and.returnValue(throwError(() => new Error('502')));
    let fallo: unknown;
    service.open('uuid-3').subscribe({ error: e => (fallo = e) });

    expect(tab.close).toHaveBeenCalled();
    expect(fallo).toBeInstanceOf(Error);
    expect(service.isCached('uuid-3')).toBeFalse();
  });

  it('tolera un contenido con prefijo data: (no lo mete en el binario)', async () => {
    repo.getNoveltyDocument.and.returnValue(
      of({ ...acta, base64: 'data:application/pdf;base64,aGk=' })
    );
    service.open('uuid-4').subscribe();

    const blob = await fetch(tab.location.href).then(r => r.blob());
    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe('hi');
  });
});
