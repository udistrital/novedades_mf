import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ContractStateService } from '../../../application/contract-state.service';
import { NoveltyService } from '../../../application/novelty.service';
import { ContractAccordionComponent } from '../../components/contract-accordion/contract-accordion.component';
import { ContractorAutocompleteComponent } from '../../components/contractor-autocomplete/contractor-autocomplete.component';
import { ConfirmAnnulModalComponent } from '../../components/confirm-annul-modal/confirm-annul-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { Contract, NoveltySummary } from '../../../domain/models/contract.entity';
import { availableVigencias } from '../../../domain/contract.rules';
import { ContractFilters } from '../../../domain/repositories/contract.repository';
import { formatExecutionDate } from '../../../../../shared/util/format.util';

interface AnnulTarget {
  contract: Contract;
  novelty: NoveltySummary;
}

type DashboardView = 'list' | 'annul-success' | 'annul-error';

/** Criterios de búsqueda excluyentes entre sí. */
type SearchBy = 'number' | 'contractor';

/**
 * Vista principal del microfrontend (Seguimiento Legal): búsqueda de
 * contratos, listado expandible con sus novedades y flujo de anulación.
 *
 * Desde aquí se navega a las páginas de creación de cada novedad según el
 * estado del contrato.
 */
@Component({
  selector: 'app-dashboard-contratos',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    ContractAccordionComponent,
    ContractorAutocompleteComponent,
    ConfirmAnnulModalComponent,
    NoveltyResultComponent,
    NoveltyErrorComponent
  ],
  templateUrl: './dashboard-contratos.component.html'
})
export class DashboardContratosComponent {
  readonly state = inject(ContractStateService);
  private readonly fb = inject(FormBuilder);
  private readonly noveltyService = inject(NoveltyService);

  filterForm: FormGroup = this.fb.group({
    year: [''],
    term: ['']
  });

  readonly years = availableVigencias();

  /** Criterio activo: se busca por número de contrato o por contratista, nunca por ambos. */
  readonly searchBy = signal<SearchBy>('number');

  /** Mensaje de validación del filtro (vacío si la búsqueda es válida). */
  readonly filterError = signal('');

  /**
   * Distingue "aún no se ha buscado" (sin mensaje) de "se buscó y no hubo resultados".
   * No hay búsqueda inicial: el backend no soporta "listar todos", así que la vista
   * arranca en blanco hasta que el usuario aplique un filtro.
   */
  readonly hasSearched = signal(false);

  // Flujo de anulación
  readonly view = signal<DashboardView>('list');
  readonly annulTarget = signal<AnnulTarget | null>(null);
  readonly showAnnulConfirm = signal(false);
  readonly annulling = signal(false);
  readonly executedAt = signal('');

  /** Cambia el criterio de búsqueda y limpia el término anterior para no arrastrar valores. */
  setSearchBy(by: SearchBy): void {
    if (this.searchBy() === by) return;
    this.searchBy.set(by);
    this.filterForm.get('term')!.reset('');
  }

  applyFilters(): void {
    const { year, term } = this.filterForm.value;
    const trimmedTerm = (term ?? '').trim();

    // El término (número o contratista) es obligatorio; la vigencia es opcional
    // ("Todos" = cualquier vigencia).
    if (!trimmedTerm) {
      this.filterError.set('Ingresa un número de contrato o contratista para buscar.');
      return;
    }

    this.filterError.set('');
    this.hasSearched.set(true);
    const filters: ContractFilters = {};
    if (year) filters.year = year;
    filters[this.searchBy()] = trimmedTerm;
    this.state.loadContracts(filters);
  }

  // --- Anulación ---
  onAnnulRequest(contract: Contract, novelty: NoveltySummary): void {
    this.annulTarget.set({ contract, novelty });
    this.showAnnulConfirm.set(true);
  }

  closeAnnulConfirm(): void {
    this.showAnnulConfirm.set(false);
  }

  // El parámetro `forceError` es el switch de pruebas del modal de anulación.
  confirmAnnul(forceError = false): void {
    const target = this.annulTarget();
    if (!target) return;

    this.annulling.set(true);
    this.noveltyService.annul(target.contract.id, target.novelty.id, forceError).subscribe({
      next: () => {
        this.annulling.set(false);
        this.showAnnulConfirm.set(false);
        this.executedAt.set(formatExecutionDate());
        this.view.set('annul-success');
      },
      error: () => {
        this.annulling.set(false);
        this.showAnnulConfirm.set(false);
        this.view.set('annul-error');
      }
    });
  }

  backToList(): void {
    this.view.set('list');
    this.annulTarget.set(null);
    this.state.loadContracts(this.state.filters());
  }
}
