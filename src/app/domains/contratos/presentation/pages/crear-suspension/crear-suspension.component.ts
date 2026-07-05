import { Component, computed, effect, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, startWith } from 'rxjs';

import { CreateNoveltyPage } from '../create-novelty-page.base';
import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
import { AdditionalClauseSectionComponent } from '../../components/additional-clause-section/additional-clause-section.component';
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
import { SuspensionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';

/** Agrega o quita `key` de los errores del control sin pisar los demás (required, min, etc.). */
function setExtraError(control: AbstractControl, key: string, hasError: boolean): void {
  const errors = { ...(control.errors ?? {}) };
  if (hasError) errors[key] = true; else delete errors[key];
  control.setErrors(Object.keys(errors).length ? errors : null);
}

@Component({
  selector: 'app-crear-suspension',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NoveltyPageLayoutComponent,
    AdditionalClauseSectionComponent,
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
  templateUrl: './crear-suspension.component.html'
})
export class CrearSuspensionComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Suspensión';

  readonly form = this.fb.group({
    fechaSolicitud: [todayIso()],
    fechaExpedicionActa: [todayIso()],
    numOficioSupervisor: ['', Validators.required],
    fechaOficioSupervisor: [todayIso()],
    numOficioOrdenador: ['', Validators.required],
    fechaOficioOrdenador: [todayIso()],
    fechaInicio: ['', Validators.required],
    fechaFin: [todayIso(), Validators.required],
    periodoDias: [{ value: null as number | null, disabled: true }],
    fechaReinicio: [{ value: '', disabled: true }],
    motivo: ['', Validators.required],
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  /** Mínimo permitido para "Fecha inicio suspensión": un día después del inicio del contrato. */
  readonly minFechaInicio = computed(() => {
    const startDate = this.state.selectedContract()?.startDate;
    return startDate ? addDaysToDate(startDate, 1) : '';
  });

  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  /** Mínimo permitido para "Fecha fin suspensión": un día después de la fecha de inicio elegida (período mínimo de 1 día). */
  get minFechaFin(): string {
    const inicio = this.form.controls.fechaInicio.value;
    return inicio ? addDaysToDate(inicio, 1) : '';
  }

  constructor() {
    super();

    const inicio = this.form.controls.fechaInicio;
    const fin = this.form.controls.fechaFin;
    const periodo = this.form.controls.periodoDias;
    const reinicio = this.form.controls.fechaReinicio;

    combineLatest([
      inicio.valueChanges.pipe(startWith(inicio.value)),
      fin.valueChanges.pipe(startWith(fin.value))
    ]).pipe(takeUntilDestroyed()).subscribe(([i, f]) => {
      // >= en vez de > : el mismo día también es inválido, el período mínimo es de 1 día.
      const fueraDeRango = !!i && !!f && i >= f;
      setExtraError(inicio, 'dateRange', fueraDeRango);
      setExtraError(fin, 'dateRange', fueraDeRango);
      setExtraError(inicio, 'minDate', !!i && !!this.minFechaInicio() && i < this.minFechaInicio());

      periodo.setValue(fueraDeRango ? null : daysBetween(i, f), { emitEvent: false });
      reinicio.setValue(f ? addDaysToDate(f, 1) : '', { emitEvent: false });
    });

    // Al cargar el contrato, fija el valor por defecto de "Fecha inicio suspensión"
    // (solo un FormControl.setValue, no escribe signals: no requiere allowSignalWrites).
    effect(() => {
      const min = this.minFechaInicio();
      if (min && !inicio.value) inicio.setValue(min);
    });
  }

  onClear(): void {
    const min = this.minFechaInicio();
    this.form.reset({
      fechaSolicitud: todayIso(),
      fechaExpedicionActa: todayIso(),
      fechaOficioSupervisor: todayIso(),
      fechaOficioOrdenador: todayIso(),
      fechaInicio: min,
      fechaFin: todayIso()
    });
  }

  protected buildDraft(): NoveltyDraft {
    const v = this.form.getRawValue();
    const draft: SuspensionDraft = {
      type: NoveltyType.SUSPENSION,
      solicitud: {
        fechaSolicitud: v.fechaSolicitud ?? '',
        fechaExpedicionActa: v.fechaExpedicionActa ?? '',
        numOficioSupervisor: v.numOficioSupervisor ?? '',
        fechaOficioSupervisor: v.fechaOficioSupervisor ?? '',
        numOficioOrdenador: v.numOficioOrdenador ?? '',
        fechaOficioOrdenador: v.fechaOficioOrdenador ?? ''
      },
      periodoDias: v.periodoDias ?? null,
      fechaInicio: v.fechaInicio ?? '',
      fechaFin: v.fechaFin ?? '',
      fechaReinicio: v.fechaReinicio ?? '',
      motivo: v.motivo ?? '',
      clausula: v.clausula as SuspensionDraft['clausula']
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
      { label: 'Inicio Suspensión', value: toDisplayDate(v.fechaInicio) },
      { label: 'Fin Suspensión', value: toDisplayDate(v.fechaFin) }
    ];
  }
}
