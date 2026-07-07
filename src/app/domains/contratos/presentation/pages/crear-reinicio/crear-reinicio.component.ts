import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, startWith } from 'rxjs';

import { CreateNoveltyPage } from '../create-novelty-page.base';
import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
import { ConfirmNoveltyModalComponent, NoveltySummaryItem } from '../../components/confirm-novelty-modal/confirm-novelty-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { FormFieldComponent } from '../../../../../shared/ui/form-field.component';
import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';
import { NoNegativeNumberDirective } from '../../../../../shared/ui/no-negative-number.directive';
import { DocumentPreviewControlComponent } from '../../../../../shared/ui/document-preview-control.component';
import { NoveltyFormActionsComponent } from '../../../../../shared/ui/novelty-form-actions.component';
import { addDaysToDate, daysBetween, toDisplayDate, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { ReinicioDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { getLatestNovelty } from '../../../domain/contract.rules';

/**
 * Página de creación de la novedad de Reinicio tras una suspensión.
 *
 * Solo es alcanzable cuando la última novedad del contrato es una Suspensión:
 * precarga sus fechas y deriva período y fecha de reinicio (fin + 1 día) como
 * campos de solo lectura.
 */
@Component({
  selector: 'app-crear-reinicio',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NoveltyPageLayoutComponent,
    ConfirmNoveltyModalComponent,
    NoveltyResultComponent,
    NoveltyErrorComponent,
    CardComponent,
    FormFieldComponent,
    FormInputDirective,
    NoNegativeNumberDirective,
    DocumentPreviewControlComponent,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-reinicio.component.html'
})
export class CrearReinicioComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Reinicio';

  readonly form = this.fb.group({
    fechaSolicitud: [todayIso()],
    fechaExpedicionActa: [todayIso()],
    // Datos de la suspensión vigente: el inicio es de solo lectura.
    fechaInicioSuspension: [{ value: '', disabled: true }],
    fechaFinSuspension: [todayIso(), Validators.required],
    // Solo lectura: se calculan a partir de inicio/fin de la suspensión.
    periodoDias: [{ value: null as number | null, disabled: true }],
    fechaReinicio: [{ value: '', disabled: true }]
  });

  constructor() {
    super();

    const inicio = this.form.controls.fechaInicioSuspension;
    const fin = this.form.controls.fechaFinSuspension;
    const periodo = this.form.controls.periodoDias;
    const reinicio = this.form.controls.fechaReinicio;

    combineLatest([
      inicio.valueChanges.pipe(startWith(inicio.value)),
      fin.valueChanges.pipe(startWith(fin.value))
    ]).pipe(takeUntilDestroyed()).subscribe(([i, f]) => {
      periodo.setValue(daysBetween(i, f), { emitEvent: false });
      reinicio.setValue(f ? addDaysToDate(f, 1) : '', { emitEvent: false });
    });

    // Fecha inicio de la suspensión: se toma de la última novedad del contrato (la suspensión
    // vigente; a esta página solo se llega cuando esa es la última novedad). Se usa la fecha
    // efectiva de la suspensión (cuándo empieza realmente), no la de expedición del acta —
    // pueden diferir. Es un FormControl.setValue, no una escritura de signal: no requiere
    // allowSignalWrites.
    effect(() => {
      const contract = this.state.selectedContract();
      const latest = contract ? getLatestNovelty(contract) : undefined;
      if (latest?.type === NoveltyType.SUSPENSION && !inicio.value) {
        inicio.setValue(addDaysToDate(latest.effectiveDate ?? latest.expeditionDate, 0));
      }
    });
  }

  onClear(): void {
    this.form.reset({
      fechaSolicitud: todayIso(),
      fechaExpedicionActa: todayIso(),
      fechaFinSuspension: todayIso()
    });
  }

  protected buildDraft(): NoveltyDraft {
    const v = this.form.getRawValue();
    const draft: ReinicioDraft = {
      type: NoveltyType.RESTART,
      solicitud: {
        fechaSolicitud: v.fechaSolicitud ?? '',
        fechaExpedicionActa: v.fechaExpedicionActa ?? ''
      },
      fechaInicioSuspension: v.fechaInicioSuspension ?? '',
      fechaFinSuspension: v.fechaFinSuspension ?? '',
      periodoDias: v.periodoDias ?? null,
      fechaReinicio: v.fechaReinicio ?? ''
    };
    return draft;
  }

  protected buildSummary(): NoveltySummaryItem[] {
    const c = this.state.selectedContract();
    const v = this.form.getRawValue();
    return [
      { label: 'Contratista', value: c?.contractorName ?? '' },
      { label: 'Ordenador del Gasto', value: c?.spendingManager ?? '' },
      { label: 'Supervisor', value: c?.supervisor ?? '' },
      { label: 'Fin Suspensión', value: toDisplayDate(v.fechaFinSuspension) },
      { label: 'Fecha de Reinicio', value: toDisplayDate(v.fechaReinicio) }
    ];
  }
}
