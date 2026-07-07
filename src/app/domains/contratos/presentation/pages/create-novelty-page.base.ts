import { Directive, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';

import { ContractStateService } from '../../application/contract-state.service';
import { NoveltyService } from '../../application/novelty.service';
import { NoveltyDraft } from '../../domain/models/novelty-draft.model';
import { NoveltySummaryItem } from '../components/confirm-novelty-modal/confirm-novelty-modal.component';
import { BreadcrumbItem } from '../../../../shared/ui/breadcrumb.component';
import { formatExecutionDate } from '../../../../shared/util/format.util';

export type NoveltyPageState = 'form' | 'success' | 'error';

/**
 * Lógica común a las páginas de creación de novedad: carga del contrato,
 * apertura del modal de confirmación y transición a éxito/error.
 * Cada página concreta aporta su formulario y define `noveltyName`,
 * `buildDraft()` y `buildSummary()`.
 */
@Directive()
export abstract class CreateNoveltyPage {
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly noveltyService = inject(NoveltyService);
  readonly state = inject(ContractStateService);

  protected readonly contractId = this.route.snapshot.paramMap.get('contractId') ?? '';

  readonly submitting = signal(false);
  readonly showConfirm = signal(false);
  /** Máquina de estados de la vista: formulario → pantalla de éxito o de error. */
  readonly pageState = signal<NoveltyPageState>('form');
  /** Fecha/hora legible del registro, mostrada en la pantalla de éxito. */
  readonly executedAt = signal('');
  /** Campos del resumen mostrados en el modal de confirmación. */
  readonly summary = signal<NoveltySummaryItem[]>([]);

  /** Vigencia (VigenciaContrato), tomada del id compuesto `${numero}_${vigencia}`. */
  readonly year = computed(() => this.state.selectedContract()?.id?.split('_').pop() ?? '');

  readonly breadcrumb = computed<BreadcrumbItem[]>(() => [
    { label: 'Seguimiento Legal', link: '/' },
    { label: `Contrato No. ${this.state.selectedContract()?.number ?? ''}`, link: '/' },
    { label: `Crear ${this.noveltyName}` }
  ]);

  /** Nombre legible de la novedad (p. ej. "Adición y Prórroga"). */
  abstract readonly noveltyName: string;
  /** Formulario de la página concreta; se valida antes de abrir la confirmación. */
  abstract readonly form: FormGroup;
  /** Construye el draft a enviar al repositorio. */
  protected abstract buildDraft(): NoveltyDraft;
  /** Construye los campos del resumen mostrados en el modal de confirmación. */
  protected abstract buildSummary(): NoveltySummaryItem[];

  constructor() {
    this.state.loadContract(this.contractId);
  }

  /**
   * Submit del formulario: si es válido abre el modal de confirmación con el
   * resumen de la página concreta; si no, marca los controles y lleva el foco
   * al primer campo inválido.
   */
  onSubmit(event: Event): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const formEl = event.target as HTMLElement;
      // Prioriza inputs nativos; si el primer inválido es un componente propio (p. ej. el
      // autocomplete de contratista), Angular pone `ng-invalid` en su host, no en un input/select/textarea.
      const firstInvalid =
        formEl.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid') ??
        formEl.querySelector<HTMLElement>('.ng-invalid');
      firstInvalid?.focus({ preventScroll: true });
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.summary.set(this.buildSummary());
    this.showConfirm.set(true);
  }

  closeConfirm(): void {
    this.showConfirm.set(false);
  }

  /**
   * Confirmación definitiva: envía el draft al caso de uso de creación y
   * transiciona la vista a éxito o error según el resultado.
   *
   * @param forceError Switch de pruebas del modal para simular una falla.
   */
  onConfirm(forceError = false): void {
    this.submitting.set(true);
    this.noveltyService.create(this.contractId, this.buildDraft(), forceError).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showConfirm.set(false);
        this.executedAt.set(formatExecutionDate());
        this.pageState.set('success');
      },
      error: () => {
        this.submitting.set(false);
        this.showConfirm.set(false);
        this.pageState.set('error');
      }
    });
  }

  /** Reintentar tras un error: vuelve al formulario. */
  onRetry(): void {
    this.pageState.set('form');
  }

  goBack(): void {
    this.router.navigateByUrl('/');
  }
}
