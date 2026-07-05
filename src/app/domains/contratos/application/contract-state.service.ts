import { Injectable, signal, computed, inject } from '@angular/core';
import { Contract } from '../domain/models/contract.entity';
import { IContractRepository, ContractFilters } from '../domain/repositories/contract.repository';
import { finalize } from 'rxjs/operators';

export interface ContractState {
  contracts: Contract[];
  isLoading: boolean;
  error: string | null;
  filters: ContractFilters;
}

@Injectable({
  providedIn: 'root'
})
export class ContractStateService {
  private readonly contractRepository = inject(IContractRepository);

  // State
  private state = signal<ContractState>({
    contracts: [],
    isLoading: false,
    error: null,
    filters: {}
  });

  // Estado de la vista de detalle (creación de novedades)
  private selectedContractState = signal<Contract | undefined>(undefined);
  private isLoadingContractState = signal(false);

  // Selectors
  readonly contracts = computed(() => this.state().contracts);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly error = computed(() => this.state().error);
  readonly filters = computed(() => this.state().filters);

  readonly selectedContract = computed(() => this.selectedContractState());
  readonly isLoadingContract = computed(() => this.isLoadingContractState());

  // Actions
  loadContracts(filters?: ContractFilters): void {
    if (filters) {
      this.updateFilters(filters);
    }

    this.state.update(state => ({ ...state, isLoading: true, error: null }));

    this.contractRepository.getContracts(this.state().filters)
      .pipe(
        finalize(() => this.state.update(state => ({ ...state, isLoading: false })))
      )
      .subscribe({
        next: (contracts) => {
          this.state.update(state => ({ ...state, contracts }));
        },
        error: (error) => {
          console.error('Error loading contracts', error);
          this.state.update(state => ({ ...state, error: 'Failed to load contracts. Please try again.' }));
        }
      });
  }

  loadContract(id: string): void {
    this.isLoadingContractState.set(true);
    this.contractRepository.getContractById(id)
      .pipe(finalize(() => this.isLoadingContractState.set(false)))
      .subscribe({
        next: (contract) => this.selectedContractState.set(contract),
        error: (error) => console.error('Error loading contract', error)
      });
  }

  /** Passthrough al repositorio para el autocomplete de contratista/cesionario. */
  searchContractors(query: string) {
    return this.contractRepository.searchContractors(query);
  }

  updateFilters(filters: ContractFilters): void {
    // Reemplaza los filtros (no acumula): cada búsqueda define el conjunto completo,
    // así "Todos" o cambiar de criterio no arrastra el filtro anterior.
    this.state.update(state => ({ ...state, filters }));
  }
}
