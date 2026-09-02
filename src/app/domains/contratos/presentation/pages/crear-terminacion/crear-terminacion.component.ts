import { Component, computed, effect, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
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
import { formatCop, toDisplayDate, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { TerminacionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { currentContractValue, maxEarlyTerminationDate, terminationImbalance } from '../../../domain/contract.rules';

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
    valorDesembolsado: [null as number | null, [Validators.required, Validators.min(1)]],
    saldoFavorContratista: [null as number | null, [Validators.required, Validators.min(0)]],
    saldoFavorUniversidad: [null as number | null, [Validators.required, Validators.min(0)]],
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  /**
   * Tope de "Fecha Terminación Anticipada": un día antes del fin vigente del
   * contrato. Alimenta el `max` del calendario y el validador, y es el valor por
   * defecto del campo.
   */
  readonly maxFechaTerminacion = computed(() => {
    const c = this.state.selectedContract();
    return c ? maxEarlyTerminationDate(c) : '';
  });

  /** La terminación no puede ser posterior al último día válido del contrato. */
  private readonly topeFechaTerminacion = (ctrl: AbstractControl): ValidationErrors | null => {
    const max = this.maxFechaTerminacion();
    return max && ctrl.value && ctrl.value > max ? { maxDate: { max } } : null;
  };

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /**
   * Lo que falta por repartir entre los tres valores de la liquidación. Cero = cuadra.
   * Se muestra en la vista mientras no cuadre, para no dejar al usuario haciendo la
   * resta a mano ni descubriendo el problema al generar el acta.
   */
  readonly restanteLiquidacion = computed(() => {
    const c = this.state.selectedContract();
    const v = this.formValue();
    return c ? terminationImbalance(c, v.valorDesembolsado, v.saldoFavorContratista, v.saldoFavorUniversidad) : 0;
  });

  readonly valorVigenteTexto = computed(() => {
    const c = this.state.selectedContract();
    return formatCop(c ? currentContractValue(c) : 0);
  });

  readonly restanteTexto = computed(() => formatCop(Math.abs(this.restanteLiquidacion())));

  /**
   * Los tres valores reparten el contrato completo, así que deben sumar su valor
   * vigente. Es la misma cuenta que valida el servicio de actas; comprobarla aquí
   * evita que el usuario llene el formulario para que se lo rechacen al final.
   */
  private readonly liquidacionCuadrada = (group: AbstractControl): ValidationErrors | null => {
    const c = this.state.selectedContract();
    if (!c) return null;
    const v = group.value as {
      valorDesembolsado?: number | null;
      saldoFavorContratista?: number | null;
      saldoFavorUniversidad?: number | null;
    };
    const restante = terminationImbalance(c, v.valorDesembolsado, v.saldoFavorContratista, v.saldoFavorUniversidad);
    return restante === 0 ? null : { balanceLiquidacion: { restante } };
  };

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
    this.form.controls.fechaTerminacion.addValidators(this.topeFechaTerminacion);
    this.form.addValidators(this.liquidacionCuadrada);
    // El tope depende del contrato: al cargarlo se revalida lo ya digitado.
    effect(() => {
      this.state.selectedContract();
      [desembolsado, saldoContratista, saldoUniversidad].forEach(ctrl => ctrl.updateValueAndValidity({ emitEvent: false }));
    });

    // Valor por defecto de la fecha de terminación: el último día válido. Solo se
    // fija mientras el usuario no la haya tocado, para no pisar lo que ya eligió.
    effect(() => {
      const max = this.maxFechaTerminacion();
      const ctrl = this.form.controls.fechaTerminacion;
      if (max && ctrl.pristine) ctrl.setValue(max);
      ctrl.updateValueAndValidity({ emitEvent: false });
    });

    // El saldo de la universidad es el resto de la liquidación (lo no ejecutado), así
    // que se sugiere solo mientras el usuario no lo haya tocado —mismo criterio que la
    // fecha de terminación—. El servicio de actas lo deriva igual cuando se omite.
    merge(desembolsado.valueChanges, saldoContratista.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const c = this.state.selectedContract();
        if (!c || !saldoUniversidad.pristine) return;
        const resto =
          currentContractValue(c) - (Number(desembolsado.value) || 0) - (Number(saldoContratista.value) || 0);
        saldoUniversidad.setValue(resto > 0 ? resto : 0, { emitEvent: false });
        this.form.updateValueAndValidity({ emitEvent: false });
      });
  }

  onClear(): void {
    this.form.reset({
      fechaSolicitud: todayIso(),
      fechaExpedicionActa: todayIso(),
      fechaOficioSupervisor: todayIso(),
      fechaOficioOrdenador: todayIso(),
      // Vuelve al último día válido del contrato, no a hoy.
      fechaTerminacion: this.maxFechaTerminacion() || todayIso(),
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
