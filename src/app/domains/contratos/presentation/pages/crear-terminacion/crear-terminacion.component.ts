import { Component, effect, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
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
import { MoneyFieldComponent } from '../../../../../shared/ui/money-field.component';
import { DocumentPreviewControlComponent } from '../../../../../shared/ui/document-preview-control.component';
import { NoveltyFormActionsComponent } from '../../../../../shared/ui/novelty-form-actions.component';
import { toDisplayDate, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { TerminacionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { currentContractValue } from '../../../domain/contract.rules';

/**
 * Página de creación de la novedad de Terminación Anticipada
 * (liquidación bilateral): captura el valor desembolsado y los saldos a favor
 * del contratista y de la universidad.
 */
@Component({
  selector: 'app-crear-terminacion',
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
    MoneyFieldComponent,
    DocumentPreviewControlComponent,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-terminacion.component.html'
})
export class CrearTerminacionComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Terminación Anticipada';

  readonly form = this.fb.group({
    fechaSolicitud: [todayIso()],
    fechaExpedicionActa: [todayIso()],
    numOficioSupervisor: ['', Validators.required],
    fechaOficioSupervisor: [todayIso()],
    numOficioOrdenador: ['', Validators.required],
    fechaOficioOrdenador: [todayIso()],
    fechaTerminacion: [todayIso()],
    fechaCertificacion: [todayIso()],
    valorDesembolsado: [null as number | null, [Validators.required, Validators.min(0)]],
    saldoFavorContratista: [null as number | null, [Validators.required, Validators.min(0)]],
    saldoFavorUniversidad: [null as number | null, [Validators.required, Validators.min(0)]],
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  /** Cada valor está topado al valor vigente del contrato (§5.6). */
  private readonly topeValorContrato = (ctrl: AbstractControl): ValidationErrors | null => {
    const c = this.state.selectedContract();
    const v = Number(ctrl.value);
    if (!c || !Number.isFinite(v) || v <= 0) return null;
    return v > currentContractValue(c) ? { maxContractValue: true } : null;
  };

  constructor() {
    super();

    const desembolsado = this.form.controls.valorDesembolsado;
    const saldoContratista = this.form.controls.saldoFavorContratista;
    const saldoUniversidad = this.form.controls.saldoFavorUniversidad;

    [desembolsado, saldoContratista, saldoUniversidad].forEach(ctrl => ctrl.addValidators(this.topeValorContrato));
    // El tope depende del contrato: al cargarlo se revalida lo ya digitado.
    effect(() => {
      this.state.selectedContract();
      [desembolsado, saldoContratista, saldoUniversidad].forEach(ctrl => ctrl.updateValueAndValidity({ emitEvent: false }));
    });

    // Regla de asignación de saldo (§5.6): los saldos son mutuamente excluyentes.
    // Con saldo a favor del contratista > 0, el saldo de la universidad queda en 0 y
    // bloqueado; con saldo del contratista en 0, la universidad recibe el saldo.
    saldoContratista.valueChanges.pipe(startWith(saldoContratista.value), takeUntilDestroyed()).subscribe(v => {
      const contratistaTieneSaldo = (Number(v) || 0) > 0;
      if (contratistaTieneSaldo) {
        saldoUniversidad.setValue(0, { emitEvent: false });
        saldoUniversidad.disable({ emitEvent: false });
      } else if (saldoUniversidad.disabled) {
        saldoUniversidad.enable({ emitEvent: false });
      }
    });
  }

  onClear(): void {
    this.form.controls.saldoFavorUniversidad.enable({ emitEvent: false });
    this.form.reset({
      fechaSolicitud: todayIso(),
      fechaExpedicionActa: todayIso(),
      fechaOficioSupervisor: todayIso(),
      fechaOficioOrdenador: todayIso(),
      fechaTerminacion: todayIso(),
      fechaCertificacion: todayIso()
    });
  }

  protected buildDraft(): NoveltyDraft {
    const v = this.form.getRawValue();
    const draft: TerminacionDraft = {
      type: NoveltyType.EARLY_TERMINATION,
      solicitud: {
        fechaSolicitud: v.fechaSolicitud ?? '',
        fechaExpedicionActa: v.fechaExpedicionActa ?? '',
        numOficioSupervisor: v.numOficioSupervisor ?? '',
        fechaOficioSupervisor: v.fechaOficioSupervisor ?? '',
        numOficioOrdenador: v.numOficioOrdenador ?? '',
        fechaOficioOrdenador: v.fechaOficioOrdenador ?? ''
      },
      fechaTerminacion: v.fechaTerminacion ?? '',
      fechaCertificacion: v.fechaCertificacion ?? '',
      valorDesembolsado: v.valorDesembolsado ?? null,
      saldoFavorContratista: v.saldoFavorContratista ?? null,
      saldoFavorUniversidad: v.saldoFavorUniversidad ?? null,
      clausula: v.clausula as TerminacionDraft['clausula']
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
      { label: 'Fecha de Terminación Anticipada', value: toDisplayDate(v.fechaTerminacion) }
    ];
  }
}
