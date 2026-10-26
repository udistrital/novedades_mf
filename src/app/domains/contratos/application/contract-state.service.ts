import { Injectable, signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Contract } from '../domain/models/contract.entity';
import { IContractRepository, ContractFilters } from '../domain/repositories/contract.repository';
import { availableVigencias } from '../domain/contract.rules';
import { ApiErrorInfo, describeApiError } from '../../../shared/http/api-error';
import { finalize } from 'rxjs/operators';

/**
 * El contrato no existe (la consulta respondió bien, pero sin filas). Se distingue
 * de un fallo del servicio: aquí no hay nada que reintentar.
 */
const CONTRATO_NO_ENCONTRADO: ApiErrorInfo = {
  code: 'CONTRATO-NO-ENCONTRADO',
  detail: 'No se encontró el contrato indicado.',
  action: 'Vuelve al panel y búscalo de nuevo; pudo cambiar desde la última consulta.'
};

/** Estado de la vista de listado: resultados, carga, error y filtros aplicados. */
export interface ContractState {
  contracts: Contract[];
  isLoading: boolean;
  error: string | null;
  filters: ContractFilters;
}

/**
 * Estado de la UI de contratos, expuesto como signals de solo lectura.
 *
 * Único intermediario entre la presentación y `IContractRepository` para las
 * consultas: los componentes leen los selectores (`contracts`, `isLoading`,
 * `selectedContract`…) y disparan acciones (`loadContracts`, `loadContract`)
 * sin conocer la infraestructura. Singleton de aplicación: el dashboard y las
 * páginas de novedad comparten esta misma instancia.
 */
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
  private contractErrorState = signal<ApiErrorInfo | null>(null);

  // Selectors
  readonly contracts = computed(() => this.state().contracts);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly error = computed(() => this.state().error);
  readonly filters = computed(() => this.state().filters);

  /**
   * Vigencias del catálogo de Ágora, para los desplegables de año. Arranca con el
   * rango calculado y se reemplaza cuando responde el backend, así el filtro nunca
   * aparece vacío mientras carga.
   */
  readonly vigencias = toSignal(this.contractRepository.getVigencias(), { initialValue: availableVigencias() });

  readonly selectedContract = computed(() => this.selectedContractState());
  readonly isLoadingContract = computed(() => this.isLoadingContractState());
  /** Por qué no se pudo cargar el contrato de la vista de detalle; `null` si cargó bien. */
  readonly contractError = computed(() => this.contractErrorState());

  // Actions

  /**
   * Busca contratos con los filtros dados y actualiza el estado del listado.
   *
   * @param filters Si se omiten, reutiliza los últimos filtros aplicados
   * (caso "recargar tras anular una novedad").
   * @remarks Asíncrono: la vista reacciona vía `contracts`/`isLoading`/`error`.
   */
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

  /**
   * Carga el contrato de una vista de detalle y lo publica en `selectedContract`.
   *
   * El fallo se publica en `contractError` distinguiendo los dos casos, porque al
   * usuario le sirven cosas distintas: si el contrato no existe no hay nada que
   * reintentar, mientras que un fallo del servicio sí admite volver a intentarlo
   * más tarde. Antes ambos terminaban en un `console.error` y la página se quedaba
   * con el formulario vacío y sin explicación.
   *
   * @param id Id compuesto `${numero}_${vigencia}` tomado de la ruta.
   */
  loadContract(id: string): void {
    this.isLoadingContractState.set(true);
    this.contractErrorState.set(null);
    this.contractRepository.getContractById(id)
      .pipe(finalize(() => this.isLoadingContractState.set(false)))
      .subscribe({
        next: (contract) => {
          this.selectedContractState.set(contract);
          if (!contract) this.contractErrorState.set(CONTRATO_NO_ENCONTRADO);
        },
        error: (error: unknown) => {
          this.selectedContractState.set(undefined);
          this.contractErrorState.set(describeApiError(error));
        }
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
