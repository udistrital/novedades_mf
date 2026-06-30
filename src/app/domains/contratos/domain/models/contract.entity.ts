import { NoveltyType, NoveltyStatus } from './novelty-type.enum';

export interface NoveltySummary {
  id: string;
  type: NoveltyType;
  expeditionDate: string;
  status: NoveltyStatus;
  documentUrl?: string;
  canAnnul: boolean;
}

export interface Contract {
  id: string;
  number: string;
  contractType: string;
  contractorName: string;
  contractorId: string; // NIT / CC
  contractingEntity: string;
  totalValue: number;
  object: string;
  initialTerm: string; // Ej. "NUEVE ( 9 ) MESES"
  startDate: string; // Ej. "01/01/2024"
  supervisor: string;
  spendingManager: string; // Ordenador del gasto
  novelties: NoveltySummary[];
}
