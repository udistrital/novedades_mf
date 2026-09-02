import { Component, computed, effect, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, startWith } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

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
import { addDaysToDate, periodDays, toDisplayDate, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { SuspensionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { contractEndDate } from '../../../domain/contract.rules';

/**
 * Agrega o quita `key` de los errores del control sin pisar los demás (required,
 * min, etc.). `payload` viaja como valor del error para los mensajes que necesitan
 * dato (p. ej. `maxDate` muestra la fecha tope).
 */
function setExtraError(control: AbstractControl, key: string, hasError: boolean, payload: unknown = true): void {
  const errors = { ...(control.errors ?? {}) };
  if (hasError) errors[key] = payload; else delete errors[key];
  control.setErrors(Object.keys(errors).length ? errors : null);
}

/**
 * Página de creación de la novedad de Suspensión.
 *
 * Reglas propias: el período mínimo es de 1 día (inicio < fin), el inicio no
 * puede ser anterior al inicio del contrato + 1, y período/fecha de reinicio
 * son campos derivados de solo lectura (reinicio = fin + 1 día).
 */
@Component({
  selector: 'app-crear-suspension',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
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
    // Máx. 249 caracteres: límite de la columna de motivo en el backend legado (§5.4).
    motivo: ['', [Validators.required, Validators.maxLength(249)]],
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

  /**
   * Máximo permitido para "Fecha fin suspensión": el último día vigente del
   * contrato. Es además su valor por defecto — una suspensión no puede extenderse
   * más allá del contrato que suspende.
   */
  readonly maxFechaFin = computed(() => {
    const c = this.state.selectedContract();
    return c ? contractEndDate(c) : '';
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
      const minInicio = this.minFechaInicio();
      setExtraError(inicio, 'minDate', !!i && !!minInicio && i < minInicio, { min: minInicio });
      // La suspensión no puede terminar después del contrato que suspende.
      const max = this.maxFechaFin();
      setExtraError(fin, 'maxDate', !!f && !!max && f > max, { max });

      periodo.setValue(fueraDeRango ? null : periodDays(i, f), { emitEvent: false });
      reinicio.setValue(f ? addDaysToDate(f, 1) : '', { emitEvent: false });
    });

    // Al cargar el contrato, fija los valores por defecto de las fechas: inicio =
    // primer día posible, fin = último día vigente del contrato. Solo mientras el
    // usuario no las haya tocado, para no pisarle lo que eligió.
    // (Solo FormControl.setValue, no escribe signals: no requiere allowSignalWrites.)
    effect(() => {
      const min = this.minFechaInicio();
      if (min && !inicio.value) inicio.setValue(min);
    });
    effect(() => {
      const max = this.maxFechaFin();
      if (max && fin.pristine) fin.setValue(max);
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
      // Vuelve al último día vigente del contrato, no a hoy.
      fechaFin: this.maxFechaFin() || todayIso()
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
