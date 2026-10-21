import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, timeout } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { ActaOptions, IActaGenerator } from '../domain/repositories/acta-generator.repository';
import { Contract } from '../domain/models/contract.entity';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { NoveltyDocument } from '../domain/models/novelty-document.model';
import { ActaMidResponse, TIPO_ACTA, toActaPayload } from './mappers/acta-payload.mapper';

/**
 * Implementación de `IActaGenerator` contra `POST novedad/generaracta` de
 * **`novedades_mid`**: un solo endpoint para las cinco actas, con el cuerpo
 * `{ tipo_acta, datos }`.
 *
 * El endpoint es sin estado: recibe todos los datos en el POST y devuelve el PDF
 * en base64. No consulta ÁGORA, no persiste nada y no valida token.
 *
 * Aún no está desplegado: corre local, así que la base es `ACTAS_MID_SERVICE`,
 * que queda fuera de la allowlist del interceptor de auth. Cuando se despliegue, la
 * base pasa a ser `NOVEDADES_MID_SERVICE` (la ruta relativa es la misma) y el
 * interceptor adjunta el token que exige el gateway.
 *
 * El acoplamiento está contenido a propósito: esta clase y `acta-payload.mapper.ts`
 * son los dos únicos archivos que conocen el contrato del generador.
 *
 * El PDF que devuelve se archiva en el gestor documental: viaja en base64 en el
 * `file` del `POST gestor_documental` de la cascada (ver `toGestorDocumentalPayload`).
 */
@Injectable({ providedIn: 'root' })
export class HttpActaMidService implements IActaGenerator {
  private readonly http = inject(HttpClient);
  private readonly base = environment.ACTAS_MID_SERVICE;

  generarActa(contract: Contract, draft: NoveltyDraft, opciones?: ActaOptions): Observable<NoveltyDocument> {
    const tipo_acta = TIPO_ACTA[draft.type];
    if (!tipo_acta) {
      return throwError(() => new Error(`No hay plantilla de acta para una novedad de ${draft.type}.`));
    }

    const body = { tipo_acta, datos: toActaPayload(contract, draft, opciones) };
    return this.http.post<ActaMidResponse>(`${this.base}${RUTA_GENERAR_ACTA}`, body).pipe(
      switchMap(res =>
        res?.file_base64
          ? of(toNoveltyDocument(res, contract))
          : throwError(() => new Error('El servicio de actas respondió sin el documento.'))
      ),
      // El acta se genera antes de registrar la novedad y la bloquea: sin tope de
      // tiempo, un servicio colgado dejaría al usuario esperando en el modal.
      timeout({
        each: TIMEOUT_ACTA_MS,
        with: () => throwError(() => new Error('El servicio de actas no respondió a tiempo.'))
      })
    );
  }
}

const RUTA_GENERAR_ACTA = 'novedad/generaracta';
const TIMEOUT_ACTA_MS = 30_000;

function toNoveltyDocument(res: ActaMidResponse, contract: Contract): NoveltyDocument {
  return {
    fileName: res.filename ?? `acta_contrato_${contract.number}.pdf`,
    mimeType: 'application/pdf',
    base64: res.file_base64 ?? ''
  };
}
