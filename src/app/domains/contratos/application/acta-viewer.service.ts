import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { IContractRepository } from '../domain/repositories/contract.repository';
import { base64ToBlob } from '../../../shared/util/base64.util';

/**
 * Caso de uso "ver el acta de una novedad".
 *
 * El mid no sirve el archivo por URL: responde el documento completo en base64
 * dentro del envoltorio `Alert`. Así que hay que descargarlo, materializarlo en
 * memoria y abrirlo desde ahí.
 *
 * Vive en `application` porque orquesta el repositorio, aunque toque `window`:
 * la pestaña debe abrirse dentro del gesto del usuario (ver `open`), lo que
 * obliga a coordinar apertura y descarga en un mismo lugar.
 */
@Injectable({ providedIn: 'root' })
export class ActaViewerService {
  private readonly repository = inject(IContractRepository);

  /**
   * Actas ya descargadas: id del documento → URL `blob:`.
   *
   * Es la caché pedida: la URL sigue viva mientras dure la página, así que abrir
   * la misma acta dos veces no vuelve a pegarle al backend. No se revocan las
   * URLs a propósito — revocarlas invalidaría las pestañas ya abiertas.
   */
  private readonly cache = new Map<string, string>();

  /** ¿El acta ya está descargada? (abrirla no costará una petición). */
  isCached(documentId: string): boolean {
    return this.cache.has(documentId);
  }

  /**
   * Abre el acta en una pestaña nueva, descargándola si no está en caché.
   *
   * La pestaña se abre de inmediato, todavía dentro del clic: si se abriera al
   * llegar la respuesta, el bloqueador de pop-ups la descartaría por no venir de
   * una interacción. Mientras carga queda en blanco, y si la descarga falla se
   * cierra.
   */
  open(documentId: string): Observable<void> {
    const tab = window.open('', '_blank');

    const cached = this.cache.get(documentId);
    if (cached) {
      this.mostrar(tab, cached);
      return of(undefined);
    }

    return this.repository.getNoveltyDocument(documentId).pipe(
      map(doc => {
        const url = URL.createObjectURL(base64ToBlob(doc.base64, doc.mimeType));
        this.cache.set(documentId, url);
        this.mostrar(tab, url);
      }),
      catchError((err: unknown) => {
        tab?.close();
        return throwError(() => err);
      })
    );
  }

  /** Lleva la pestaña al documento; si el navegador la bloqueó, se reintenta directo. */
  private mostrar(tab: Window | null, url: string): void {
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
  }
}
