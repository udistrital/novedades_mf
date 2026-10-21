import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { IContractRepository } from '../domain/repositories/contract.repository';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';
import { NoveltyType } from '../domain/models/novelty-type.enum';

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

  create(contractId: string, draft: NoveltyDraft, actaBase64 = ''): Observable<void> {
    return this.contractRepository.createNovelty(contractId, draft, actaBase64);
  }

  annul(contractId: string, noveltyId: string, type: NoveltyType): Observable<void> {
    return this.contractRepository.annulNovelty(contractId, noveltyId, type);
  }

  /** Reapertura administrativa de un contrato Finalizado (vuelve a "En ejecución"). */
  activate(contractId: string): Observable<void> {
    return this.contractRepository.activateContract(contractId);
  }
}
