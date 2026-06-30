import { NoveltyType, NoveltyStatus } from '../../domain/models/novelty-type.enum';

export interface NoveltySummaryDto {
  id: string;
  type: NoveltyType;
  expeditionDate: string;
  status: NoveltyStatus;
  documentUrl?: string;
  canAnnul: boolean;
}

export interface ContractResponseDto {
  id: string;
  number: string;
  contractType: string;
  contractorName: string;
  contractorId: string;
  contractingEntity: string;
  totalValue: number;
  object: string;
  initialTerm: string;
  startDate: string;
  supervisor: string;
  spendingManager: string;
  novelties: NoveltySummaryDto[];
}
