import { Injectable, inject } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { IContractRepository } from '../domain/repositories/contract.repository';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';

/**
 * Casos de uso de escritura sobre novedades: crear y anular.
 *
 * Separa a las páginas de creación y al dashboard del repositorio, de modo que
 * el manejo transaccional que defina el backend (réplica, compensación) tenga
 * un único punto de entrada en la aplicación.
 */
@Injectable({
  providedIn: 'root'
})
export class NoveltyService {
  private readonly contractRepository = inject(IContractRepository);

  // TEST SWITCH — `forceError` solo existe para el switch de pruebas de los modales
  // de confirmación/anulación. Borrar el parámetro y el `if` de cada método para quitarlo.
  // El delay imita la latencia del mock real para que el estado de carga sea visible.
  create(contractId: string, draft: NoveltyDraft, forceError = false): Observable<void> {
    if (forceError) return timer(400).pipe(switchMap(() => throwError(() => new Error('[TEST] Falla simulada'))));
    return this.contractRepository.createNovelty(contractId, draft);
  }

  annul(contractId: string, noveltyId: string, forceError = false): Observable<void> {
    if (forceError) return timer(400).pipe(switchMap(() => throwError(() => new Error('[TEST] Falla simulada'))));
    return this.contractRepository.annulNovelty(contractId, noveltyId);
  }
}
