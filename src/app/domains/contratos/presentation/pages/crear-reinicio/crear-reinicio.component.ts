import { Component, computed, effect, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, startWith } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

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
import { addDaysToDate, periodDays, toDisplayDate, toIsoDate, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { NoveltySummary } from '../../../domain/models/contract.entity';
import { ReinicioDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { activeSuspension } from '../../../domain/contract.rules';

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
    MatIconModule,
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

  /**
   * Tope de "Fecha fin suspensión": el fin registrado en la suspensión vigente.
   * El reinicio puede adelantarse (terminar la suspensión antes de lo previsto),
   * nunca extenderla más allá de lo ya aprobado.
   */
  readonly maxFinSuspension = computed(() => this.finSuspension());

  /**
   * Piso de "Fecha fin suspensión": un día después de su inicio. Misma regla que en la
   * creación de la suspensión —el período mínimo es de un día—, que aquí faltaba: el
   * campo solo tenía tope superior, así que adelantar el fin por debajo del inicio
   * daba un período negativo y así viajaba a la novedad y al acta.
   */
  readonly minFinSuspension = computed(() => {
    const inicio = this.inicioSuspension();
    return inicio ? addDaysToDate(inicio, 1) : '';
  });

  /** La fecha de fin no puede ser posterior a la registrada en la suspensión. */
  private readonly topeFinSuspension = (ctrl: AbstractControl): ValidationErrors | null => {
    const max = this.maxFinSuspension();
    return max && ctrl.value && ctrl.value > max ? { maxDate: { max } } : null;
  };

  /** … ni anterior al inicio de esa misma suspensión. */
  private readonly pisoFinSuspension = (ctrl: AbstractControl): ValidationErrors | null => {
    const min = this.minFinSuspension();
    return min && ctrl.value && ctrl.value < min ? { minDate: { min } } : null;
  };

  constructor() {
    super();

    const inicio = this.form.controls.fechaInicioSuspension;
    const fin = this.form.controls.fechaFinSuspension;
    const periodo = this.form.controls.periodoDias;
    const reinicio = this.form.controls.fechaReinicio;

    fin.addValidators([this.topeFinSuspension, this.pisoFinSuspension]);

    combineLatest([
      inicio.valueChanges.pipe(startWith(inicio.value)),
      fin.valueChanges.pipe(startWith(fin.value))
    ]).pipe(takeUntilDestroyed()).subscribe(([i, f]) => {
      // Un período inválido se deja en blanco en vez de mostrar un número negativo.
      periodo.setValue(!!i && !!f && i >= f ? null : periodDays(i, f), { emitEvent: false });
      reinicio.setValue(f ? addDaysToDate(f, 1) : '', { emitEvent: false });
    });

    // Período de la suspensión vigente: se precarga tal como quedó registrado en la
    // novedad (`FechaSuspension` / `FechaFinSuspension`), no con la fecha de hoy ni
    // con la de expedición del acta, que pueden diferir del período real.
    // (A esta página solo se llega cuando la última novedad es una suspensión.)
    // Son FormControl.setValue, no escrituras de signal: no requiere allowSignalWrites.
    effect(() => {
      const suspension = this.suspensionVigente();
      if (!suspension) return;
      if (!inicio.value) inicio.setValue(this.inicioSuspension());
      if (fin.pristine) fin.setValue(this.finSuspension());
      fin.updateValueAndValidity({ emitEvent: false });
    });
  }

  /** Suspensión que este reinicio reanuda: la última novedad del contrato. */
  private suspensionVigente(): NoveltySummary | undefined {
    const contract = this.state.selectedContract();
    return contract ? activeSuspension(contract) : undefined;
  }

  /** Inicio real de la suspensión; cae a la expedición del acta si el backend no lo trae. */
  private inicioSuspension(): string {
    const s = this.suspensionVigente();
    return toIsoDate(s?.effectiveDate ?? s?.expeditionDate ?? '');
  }

  private finSuspension(): string {
    return toIsoDate(this.suspensionVigente()?.effectiveEndDate ?? '') || todayIso();
  }

  onClear(): void {
    this.form.reset({
      fechaSolicitud: todayIso(),
      fechaExpedicionActa: todayIso(),
      // Vuelve al período registrado en la suspensión, no a hoy.
      fechaInicioSuspension: this.inicioSuspension(),
      fechaFinSuspension: this.finSuspension()
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
