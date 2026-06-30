import { Observable } from 'rxjs';
import { Contract } from '../models/contract.entity';
import { NoveltyDraft } from '../models/novelty-draft.model';

export interface ContractFilters {
  number?: string;
  contractor?: string;
  year?: string;
}

export abstract class IContractRepository {
  abstract getContracts(filters?: ContractFilters): Observable<Contract[]>;
  abstract getContractById(id: string): Observable<Contract | undefined>;
  abstract createNovelty(contractId: string, draft: NoveltyDraft): Observable<void>;
  abstract annulNovelty(contractId: string, noveltyId: string): Observable<void>;
}
