import { Observable } from 'rxjs';
import { Contract } from '../models/contract.entity';
import { NoveltyDraft } from '../models/novelty-draft.model';
import { Assignee } from '../models/assignee.model';

/** Criterios de búsqueda del dashboard; `number` y `contractor` son excluyentes entre sí. */
export interface ContractFilters {
  number?: string;
  contractor?: string;
  year?: string;
}

/**
 * Puerto de acceso a contratos y novedades (patrón repositorio de DDD).
 *
 * Clase abstracta en lugar de interface para poder usarse como token de DI:
 * la implementación activa se registra en `app.config.ts`
 * (`HttpContractService` contra las APIs reales, `MockContractService` para
 * desarrollo sin backend). Las capas de aplicación y presentación solo
 * dependen de esta abstracción.
 */
export abstract class IContractRepository {
  abstract getContracts(filters?: ContractFilters): Observable<Contract[]>;
  abstract getContractById(id: string): Observable<Contract | undefined>;
  abstract createNovelty(contractId: string, draft: NoveltyDraft): Observable<void>;
  abstract annulNovelty(contractId: string, noveltyId: string): Observable<void>;
  /** Busca contratistas por cédula/NIT para el autocomplete (cédula + nombre). */
  abstract searchContractors(query: string): Observable<Assignee[]>;
}
