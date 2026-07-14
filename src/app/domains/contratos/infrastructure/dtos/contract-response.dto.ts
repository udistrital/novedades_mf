import { NoveltyType, NoveltyStatus } from '../../domain/models/novelty-type.enum';

/**
 * Forma de respuesta que usa `MockContractService` para sus datos quemados.
 * Es deliberadamente paralela al modelo de dominio; las APIs reales usan
 * `legacy-api.dto.ts` + mapper.
 */
export interface NoveltySummaryDto {
  id: string;
  type: NoveltyType;
  expeditionDate: string;
  effectiveDate?: string;
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
  supervisorDocument?: string;
  spendingManager: string;
  novelties: NoveltySummaryDto[];
}
