import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, timeout } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { ActaOptions, IActaGenerator } from '../domain/repositories/acta-generator.repository';
import { Contract } from '../domain/models/contract.entity';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { NoveltyDocument } from '../domain/models/novelty-document.model';
import { ACTA_ENDPOINT, ActaMidResponse, toActaPayload } from './mappers/acta-payload.mapper';

/**
 * Implementación de `IActaGenerator` contra **`actas_novedad_mid`**.
 *
 * Es un middleware sin estado: recibe todos los datos en el POST y devuelve el
 * PDF en base64. No consulta ÁGORA, no persiste nada y no valida token (por eso
 * su URL queda fuera de la allowlist del interceptor de auth).
 *
 * ⚠️ **Servicio temporal.** Va a reemplazarse por otro generador de actas. El
 * acoplamiento está contenido a propósito: esta clase y `acta-payload.mapper.ts`
 * son los dos únicos archivos que conocen su contrato. Para cambiarlo, escribir
 * otra implementación del puerto y cambiar el binding en `app.config.ts`.
 *
 * El PDF **no se envía al backend**: hoy solo se descarga para el usuario, y el
 * gestor documental sigue recibiendo `file: ''` (ver `toGestorDocumentalPayload`).
 */
@Injectable({ providedIn: 'root' })
export class HttpActaMidService implements IActaGenerator {
  private readonly http = inject(HttpClient);
  private readonly base = environment.ACTAS_MID_SERVICE;

  generarActa(contract: Contract, draft: NoveltyDraft, opciones?: ActaOptions): Observable<NoveltyDocument> {
    const ruta = ACTA_ENDPOINT[draft.type];
    if (!ruta) {
      return throwError(() => new Error(`No hay plantilla de acta para una novedad de ${draft.type}.`));
    }

    return this.http.post<ActaMidResponse>(`${this.base}${ruta}`, toActaPayload(contract, draft, opciones)).pipe(
      switchMap(res =>
        res?.file_base64
          ? of(toNoveltyDocument(res, contract))
          : throwError(() => new Error('El servicio de actas respondió sin el documento.'))
      ),
      // La generación corre después de que la novedad ya quedó registrada: sin tope
      // de tiempo, un servicio colgado dejaría al usuario esperando en el modal.
      timeout({
        each: TIMEOUT_ACTA_MS,
        with: () => throwError(() => new Error('El servicio de actas no respondió a tiempo.'))
      })
    );
  }
}

const TIMEOUT_ACTA_MS = 30_000;

function toNoveltyDocument(res: ActaMidResponse, contract: Contract): NoveltyDocument {
  return {
    fileName: res.filename ?? `acta_contrato_${contract.number}.pdf`,
    mimeType: 'application/pdf',
    base64: res.file_base64 ?? ''
  };
}
