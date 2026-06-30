import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { IContractRepository } from '../domain/repositories/contract.repository';
import { NoveltyDraft } from '../domain/models/novelty-draft.model';

/** Caso de uso: crear una novedad (adición/prórroga, suspensión, cesión, terminación). */
@Injectable({
  providedIn: 'root'
})
export class NoveltyService {
  private readonly contractRepository = inject(IContractRepository);

  create(contractId: string, draft: NoveltyDraft): Observable<void> {
    return this.contractRepository.createNovelty(contractId, draft);
  }

  annul(contractId: string, noveltyId: string): Observable<void> {
    return this.contractRepository.annulNovelty(contractId, noveltyId);
  }
}
