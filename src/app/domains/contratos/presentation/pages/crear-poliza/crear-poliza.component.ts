import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';

import { ContractStateService } from '../../../application/contract-state.service';
import { IContractRepository } from '../../../domain/repositories/contract.repository';
import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { getLatestNovelty } from '../../../domain/contract.rules';
import { Poliza } from '../../../domain/models/poliza.model';

import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
import { ConfirmNoveltyModalComponent, NoveltySummaryItem } from '../../components/confirm-novelty-modal/confirm-novelty-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { FormFieldComponent } from '../../../../../shared/ui/form-field.component';
import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';
import { NoveltyFormActionsComponent } from '../../../../../shared/ui/novelty-form-actions.component';
import { BreadcrumbItem } from '../../../../../shared/ui/breadcrumb.component';
import { formatExecutionDate } from '../../../../../shared/util/format.util';

type PageState = 'form' | 'success' | 'error';

/**
 * Registro de póliza del cesionario (acta de inicio, paso posterior a una
 * cesión): con el contrato en "Cesión pendiente de póliza" se selecciona la
 * entidad aseguradora y el número de póliza, y se ACTUALIZA el registro de
 * póliza que la cesión dejó creado (PUT, nunca crea uno nuevo).
 *
 * No extiende `CreateNoveltyPage` porque no crea una novedad (no hay draft):
 * completa un registro asociado a la última cesión del contrato.
 */
@Component({
  selector: 'app-crear-poliza',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    NoveltyPageLayoutComponent,
    ConfirmNoveltyModalComponent,
    NoveltyResultComponent,
    NoveltyErrorComponent,
    CardComponent,
    FormFieldComponent,
    FormInputDirective,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-poliza.component.html'
})
export class CrearPolizaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(IContractRepository);
  private readonly fb = inject(FormBuilder);
  readonly state = inject(ContractStateService);

  private readonly contractId = this.route.snapshot.paramMap.get('contractId') ?? '';

  readonly pageState = signal<PageState>('form');
  readonly submitting = signal(false);
  readonly showConfirm = signal(false);
  readonly executedAt = signal('');
  readonly summary = signal<NoveltySummaryItem[]>([]);
  /** Póliza existente de la última cesión; null mientras carga o si no se encontró. */
  readonly poliza = signal<Poliza | null>(null);

  readonly aseguradoras = toSignal(this.repository.getAseguradoras(), { initialValue: [] });

  readonly breadcrumb = computed<BreadcrumbItem[]>(() => [
    { label: 'Seguimiento Legal', link: '/' },
    { label: `Contrato No. ${this.state.selectedContract()?.number ?? ''}`, link: '/' },
    { label: 'Registrar Póliza' }
  ]);

  readonly form = this.fb.group({
    entidadAseguradoraId: [null as number | null, Validators.required],
    numeroPoliza: ['', Validators.required]
  });

  constructor() {
    this.state.loadContract(this.contractId);

    // La póliza pende de la última cesión del contrato: se resuelve al cargarlo.
    effect(() => {
      const contract = this.state.selectedContract();
      if (!contract || this.poliza()) return;
      const cesion = contract.novelties.filter(n => n.type === NoveltyType.ASSIGNMENT);
      const novedad = cesion.length ? cesion[cesion.length - 1] : getLatestNovelty(contract);
      if (!novedad) return;
      this.repository.getPolizaDeNovedad(novedad.id).subscribe(p => {
        if (!p) return;
        this.poliza.set(p);
        // Precarga lo ya registrado (el PUT actualiza, no duplica).
        this.form.patchValue({
          entidadAseguradoraId: p.entidadAseguradoraId,
          numeroPoliza: p.numeroPoliza
        });
      });
    });
  }

  onSubmit(event: Event): void {
    if (this.form.invalid || !this.poliza()) {
      this.form.markAllAsTouched();
      const formEl = event.target as HTMLElement;
      const firstInvalid =
        formEl.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid') ??
        formEl.querySelector<HTMLElement>('.ng-invalid');
      firstInvalid?.focus({ preventScroll: true });
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const v = this.form.getRawValue();
    const aseguradora = this.aseguradoras().find(a => a.id === Number(v.entidadAseguradoraId));
    this.summary.set([
      { label: 'Cesionario', value: this.state.selectedContract()?.contractorName ?? '' },
      { label: 'Entidad Aseguradora', value: aseguradora?.nombre ?? String(v.entidadAseguradoraId) },
      { label: 'Número de Póliza', value: v.numeroPoliza ?? '', highlight: true }
    ]);
    this.showConfirm.set(true);
  }

  closeConfirm(): void {
    this.showConfirm.set(false);
  }

  onConfirm(): void {
    const poliza = this.poliza();
    if (!poliza) return;
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.repository.updatePoliza(poliza.id, {
      entidadAseguradoraId: Number(v.entidadAseguradoraId),
      numeroPoliza: v.numeroPoliza ?? ''
    }).subscribe({
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

  onClear(): void {
    this.form.reset();
  }

  onRetry(): void {
    this.pageState.set('form');
  }

  goBack(): void {
    this.router.navigateByUrl('/');
  }
}
