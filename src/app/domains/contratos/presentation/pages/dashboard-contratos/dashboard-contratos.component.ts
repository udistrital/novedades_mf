import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ContractStateService } from '../../../application/contract-state.service';
import { NoveltyService } from '../../../application/novelty.service';
import { ContractAccordionComponent } from '../../components/contract-accordion/contract-accordion.component';
import { ContractorAutocompleteComponent } from '../../components/contractor-autocomplete/contractor-autocomplete.component';
import { ConfirmAnnulModalComponent } from '../../components/confirm-annul-modal/confirm-annul-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { ModalShellComponent } from '../../../../../shared/ui/modal-shell.component';
import { Contract, NoveltySummary } from '../../../domain/models/contract.entity';
import { ContractFilters } from '../../../domain/repositories/contract.repository';
import { formatExecutionDate } from '../../../../../shared/util/format.util';
import { ApiErrorInfo, describeApiError } from '../../../../../shared/http/api-error';

interface AnnulTarget {
  contract: Contract;
  novelty: NoveltySummary;
}

type DashboardView = 'list' | 'annul-success' | 'annul-error' | 'activate-success' | 'activate-error';

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
    NoveltyErrorComponent,
    ModalShellComponent
  ],
  templateUrl: './dashboard-contratos.component.html'
})
export class DashboardContratosComponent {
  readonly state = inject(ContractStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly noveltyService = inject(NoveltyService);

  filterForm: FormGroup = this.fb.group({
    year: [''],
    term: ['']
  });

  /** Vigencias del catálogo del backend (ver `ContractStateService.vigencias`). */
  readonly years = this.state.vigencias;

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
  /**
   * Error real de la última operación fallida (anulación o activación), traducido
   * para el usuario. Uno solo: las dos vistas de error nunca se muestran a la vez.
   */
  readonly errorInfo = signal<ApiErrorInfo | null>(null);

  // Flujo de activación (reapertura administrativa de un contrato Finalizado)
  readonly activateTarget = signal<Contract | null>(null);
  readonly activating = signal(false);

  /**
   * Detalle desplegado de entrada: buscar por número + vigencia identifica un
   * contrato único, así que no tiene sentido obligar a un clic extra para verlo.
   */
  readonly autoExpandirDetalle = computed(() => {
    const { number, year } = this.state.filters();
    return !!number && !!year && this.state.contracts().length === 1;
  });

  constructor() {
    // Estos cambios de vista no navegan de ruta (siguen en el dashboard), así que el
    // scroll restoration del router no aplica: hay que subir el scroll a mano.
    effect(() => {
      this.view();
      window.scrollTo(0, 0);
    });

    // Al volver de una página de novedad, el listado en memoria está desactualizado
    // (no incluye la novedad recién creada). Se repite la búsqueda para que vea el
    // dato fresco.
    this.restaurarUltimaBusqueda();
  }

  /**
   * Repuebla el panel al entrar. Dos fuentes, en este orden:
   *
   * 1. El contrato que viene en la URL (`?contrato=…&vigencia=…`), que es como
   *    vuelven las páginas de novedad: consulta ese contrato aunque no haya nada en
   *    memoria —el caso que dejaba el panel en blanco tras recargar o entrar por
   *    enlace directo—.
   * 2. Los últimos filtros del usuario, para cualquier otra vuelta al panel.
   */
  private restaurarUltimaBusqueda(): void {
    const contrato = this.route.snapshot.queryParamMap.get('contrato');
    if (contrato) {
      this.searchBy.set('number');
      this.filterForm.setValue({ year: this.route.snapshot.queryParamMap.get('vigencia') ?? '', term: contrato });
      this.applyFilters();
      return;
    }
    const { number, contractor, year } = this.state.filters();
    const term = number ?? contractor;
    if (!term) return;
    this.searchBy.set(number ? 'number' : 'contractor');
    this.filterForm.setValue({ year: year ?? '', term });
    this.hasSearched.set(true);
    this.state.loadContracts();
  }

  /** Cambia el criterio de búsqueda y limpia el término anterior para no arrastrar valores. */
  setSearchBy(by: SearchBy): void {
    if (this.searchBy() === by) return;
    this.searchBy.set(by);
    this.filterForm.get('term')!.reset('');
  }

  /** Limpia el campo activo (número de contrato o contratista) sin tocar la vigencia. */
  clearTerm(): void {
    this.filterForm.get('term')!.reset('');
    this.filterError.set('');
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
    // La guarda cubre el reintento desde la pantalla de error: sin ella, un doble
    // clic dispararía dos anulaciones sobre la misma novedad.
    if (!target || this.annulling()) return;

    this.annulling.set(true);
    this.errorInfo.set(null);
    this.noveltyService.annul(target.contract.id, target.novelty.id, target.novelty.type, forceError).subscribe({
      next: () => {
        this.annulling.set(false);
        this.showAnnulConfirm.set(false);
        this.executedAt.set(formatExecutionDate());
        this.view.set('annul-success');
      },
      error: (err: unknown) => {
        this.annulling.set(false);
        this.showAnnulConfirm.set(false);
        this.errorInfo.set(describeApiError(err));
        this.view.set('annul-error');
      }
    });
  }

  // --- Activación (contrato Finalizado → En ejecución) ---
  onActivateRequest(contract: Contract): void {
    this.activateTarget.set(contract);
  }

  closeActivateConfirm(): void {
    this.activateTarget.set(null);
  }

  confirmActivate(): void {
    const contract = this.activateTarget();
    if (!contract || this.activating()) return;

    this.activating.set(true);
    this.errorInfo.set(null);
    this.noveltyService.activate(contract.id).subscribe({
      next: () => {
        this.activating.set(false);
        this.executedAt.set(formatExecutionDate());
        this.view.set('activate-success');
      },
      error: (err: unknown) => {
        this.activating.set(false);
        this.errorInfo.set(describeApiError(err));
        this.view.set('activate-error');
      }
    });
  }

  backToList(): void {
    this.view.set('list');
    this.annulTarget.set(null);
    this.activateTarget.set(null);
    this.state.loadContracts(this.state.filters());
  }
}
