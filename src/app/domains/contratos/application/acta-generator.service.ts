import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { IActaGenerator } from '../domain/repositories/acta-generator.repository';
import { IContractRepository } from '../domain/repositories/contract.repository';
import { Contract } from '../domain/models/contract.entity';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { NoveltyType } from '../domain/models/novelty-type.enum';
import { NoveltyDocument } from '../domain/models/novelty-document.model';
import { base64ToBlob } from '../../../shared/util/base64.util';

/**
 * Casos de uso del acta de una novedad: generarla, descargarla y previsualizarla.
 *
 * El acta se genera **antes** de registrar la novedad, así que sus errores **sí se
 * propagan**: una novedad no debe quedar registrada si su acta —el documento
 * jurídico que la formaliza— no se pudo producir. Antes corría después y se
 * tragaba los errores, precisamente porque ya no había nada que abortar.
 *
 * Vive en `application` porque orquesta un puerto, aunque toque el DOM para
 * disparar la descarga o abrir la pestaña (mismo criterio que `ActaViewerService`).
 */
@Injectable({ providedIn: 'root' })
export class ActaGeneratorService {
  private readonly generator = inject(IActaGenerator);
  private readonly repository = inject(IContractRepository);

  /**
   * Genera el acta de la novedad. Los errores se propagan al llamador.
   *
   * Antes resuelve lo que el acta imprime pero no sale del formulario: los
   * firmantes del cuadro final (quien elabora y quien aprueba) y, donde el
   * documento lo imprime, el CDP/CRP del encabezado. Ninguna de las dos consultas
   * falla: son campos opcionales del acta, y el servicio imprime su marcador
   * cuando no llegan.
   */
  generar(contract: Contract, draft: NoveltyDraft, tamanoLetra?: number): Observable<NoveltyDocument> {
    return forkJoin({
      responsables: this.repository.getActaResponsables(),
      cdpRp: ACTAS_CON_CDP_RP.includes(draft.type) ? this.repository.getCdpRp(contract) : of(SIN_CDP_RP)
    }).pipe(
      switchMap(({ responsables, cdpRp }) =>
        this.generator.generarActa(contract, draft, { ...responsables, ...cdpRp, tamanoLetra })
      )
    );
  }

  /** Descarga en el equipo del usuario un acta ya generada. */
  descargar(doc: NoveltyDocument): void {
    const url = URL.createObjectURL(base64ToBlob(doc.base64, doc.mimeType));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = doc.fileName;
    // Debe estar en el DOM: algunos navegadores ignoran el click de un nodo suelto.
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // A diferencia de la previsualización, aquí sí se revoca: la descarga ya arrancó
    // y no queda ninguna pestaña dependiendo de la URL.
    URL.revokeObjectURL(url);
  }

  /**
   * Genera el acta y la **abre en una pestaña**, sin descargar ningún archivo:
   * el PDF vive en memoria como `blob:` y se descarta al cerrar la pestaña.
   *
   * La pestaña se abre de inmediato, todavía dentro del clic: si se abriera al
   * llegar la respuesta, el bloqueador de pop-ups la descartaría por no venir de
   * una interacción. Mientras genera queda en blanco, y si falla se cierra.
   * La URL `blob:` no se revoca a propósito — revocarla dejaría la pestaña vacía.
   */
  previsualizar(contract: Contract, draft: NoveltyDraft, tamanoLetra?: number): Observable<void> {
    const tab = window.open('', '_blank');
    return this.generar(contract, draft, tamanoLetra).pipe(
      map(doc => {
        const url = URL.createObjectURL(base64ToBlob(doc.base64, doc.mimeType));
        if (tab) tab.location.href = url;
        // Si el navegador bloqueó la pestaña, se reintenta directo desde el clic.
        else window.open(url, '_blank');
      }),
      catchError((err: unknown) => {
        tab?.close();
        return throwError(() => err);
      })
    );
  }
}

/**
 * Actas que imprimen el CDP/CRP en su encabezado y por eso pagan la consulta a
 * `financiera_jbpm`, que es **lenta**: el resto genera sin ella.
 *
 * Son las tres que el cliente legado también consulta. En adición y prórroga no hace
 * falta —el CDP lo digita el usuario en el formulario— y el reinicio no imprime
 * ninguno de los dos.
 */
const ACTAS_CON_CDP_RP: readonly NoveltyType[] = [
  NoveltyType.SUSPENSION,
  NoveltyType.ASSIGNMENT,
  NoveltyType.EARLY_TERMINATION
];

/** Sin consulta no hay CDP/CRP: el acta imprime su marcador. */
const SIN_CDP_RP = { cdp: '', rp: '' };
