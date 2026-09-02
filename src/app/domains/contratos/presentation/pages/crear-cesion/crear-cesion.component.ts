import { Component, computed, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { CreateNoveltyPage } from '../create-novelty-page.base';
import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
import { AdditionalClauseSectionComponent } from '../../components/additional-clause-section/additional-clause-section.component';
import { AssigneeInfoCardComponent } from '../../components/assignee-info-card/assignee-info-card.component';
import { ContractorAutocompleteComponent } from '../../components/contractor-autocomplete/contractor-autocomplete.component';
import { ConfirmNoveltyModalComponent, NoveltySummaryItem } from '../../components/confirm-novelty-modal/confirm-novelty-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { FormFieldComponent } from '../../../../../shared/ui/form-field.component';
import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';
import { NoNegativeNumberDirective } from '../../../../../shared/ui/no-negative-number.directive';
import { MoneyFieldComponent } from '../../../../../shared/ui/money-field.component';
import { ToggleSectionComponent } from '../../../../../shared/ui/toggle-section.component';
import { DocumentPreviewControlComponent } from '../../../../../shared/ui/document-preview-control.component';
import { NoveltyFormActionsComponent } from '../../../../../shared/ui/novelty-form-actions.component';
import { addDaysToDate, formatCop, toDisplayDate, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { CesionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { Assignee } from '../../../domain/models/assignee.model';
import { contractEndDate, currentContractValue } from '../../../domain/contract.rules';

/**
 * Página de creación de la novedad de Cesión: transfiere el contrato del
 * contratista actual (cedente) a un cesionario elegido por documento.
 *
 * Reglas propias: la fecha de terminación del cedente se deriva de la fecha de
 * cesión (−1 día, solo lectura) y el Considerando Adicional replica la
 * obligatoriedad condicional de la Cláusula Adicional.
 */
@Component({
  selector: 'app-crear-cesion',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    NoveltyPageLayoutComponent,
    AdditionalClauseSectionComponent,
    AssigneeInfoCardComponent,
    ContractorAutocompleteComponent,
    ConfirmNoveltyModalComponent,
    NoveltyResultComponent,
    NoveltyErrorComponent,
    CardComponent,
    FormFieldComponent,
    FormInputDirective,
    NoNegativeNumberDirective,
    MoneyFieldComponent,
    ToggleSectionComponent,
    DocumentPreviewControlComponent,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-cesion.component.html'
})
export class CrearCesionComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Cesión';

  /**
   * Interruptor de la posición del considerando, hoy **apagado** por decisión de
   * negocio: el campo no se le pide al usuario, pero el control, el draft y el
   * payload siguen intactos. Ponerlo en `true` restituye el campo y su
   * obligatoriedad. Equivalente a `MOSTRAR_POSICION` de la cláusula adicional.
   */
  protected readonly MOSTRAR_POSICION_CONSIDERANDO = false;

  /** Sin selección todavía: la tarjeta permanece visible pero sin datos hasta elegir la cédula. */
  readonly assignee = signal<Assignee | null>(null);

  readonly form = this.fb.group({
    fechaSolicitud: [todayIso()],
    fechaExpedicionActa: [todayIso()],
    numOficioSupervisor: ['', Validators.required],
    fechaOficioSupervisor: [todayIso()],
    numOficioOrdenador: ['', Validators.required],
    fechaOficioOrdenador: [todayIso()],
    fechaSesion: [todayIso()],
    fechaTerminacionCedente: [{ value: '', disabled: true }],
    valorDesembolsado: [null as number | null, [Validators.required, Validators.min(1)]],
    valorFavorCedente: [null as number | null, [Validators.required, Validators.min(1)]],
    diasFaltantes: [null as number | null, Validators.min(1)],
    cedulaCesionario: ['', Validators.required],
    considerando: this.fb.group({
      activo: [false],
      posicion: [null as number | null, Validators.min(1)],
      texto: ['']
    }),
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  get considerando(): FormGroup { return this.form.get('considerando') as FormGroup; }
  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Valor vigente del contrato (base + adiciones históricas): tope de los valores de la cesión. */
  readonly valorVigente = computed(() => {
    const c = this.state.selectedContract();
    return c ? currentContractValue(c) : 0;
  });

  /** Saldo restante para el cesionario = valor vigente − (a favor del cedente + desembolsado). */
  readonly saldoCesionario = computed(() => {
    const v = this.formValue();
    const usado = (Number(v?.valorFavorCedente) || 0) + (Number(v?.valorDesembolsado) || 0);
    return this.valorVigente() - usado;
  });

  readonly saldoCesionarioTexto = computed(() => formatCop(this.saldoCesionario()));

  /**
   * Tope de "Fecha cesión": el fin vigente del contrato.
   *
   * Ceder después de esa fecha no deja nada que ejecutar al cesionario, y el acta lo
   * hace evidente: su "por un plazo de …" —que se deriva de esta fecha hasta el fin
   * del contrato— sale en blanco (`________`) porque el plazo resultante es negativo.
   */
  readonly maxFechaCesion = computed(() => {
    const c = this.state.selectedContract();
    return c ? contractEndDate(c) : '';
  });

  /** La cesión no puede ser posterior al fin vigente del contrato. */
  private readonly topeFechaCesion = (ctrl: AbstractControl): ValidationErrors | null => {
    const max = this.maxFechaCesion();
    return max && ctrl.value && ctrl.value > max ? { maxDate: { max } } : null;
  };

  /** Los valores de la cesión no pueden superar el valor vigente del contrato (§5.3). */
  private readonly topeValorContrato = (ctrl: AbstractControl): ValidationErrors | null => {
    const c = this.state.selectedContract();
    const v = Number(ctrl.value);
    if (!c || !Number.isFinite(v) || v <= 0) return null;
    return v > currentContractValue(c) ? { maxContractValue: true } : null;
  };

  constructor() {
    super();

    // Topes contra el valor del contrato en los dos valores monetarios.
    const desembolsado = this.form.controls.valorDesembolsado;
    const favorCedente = this.form.controls.valorFavorCedente;
    desembolsado.addValidators(this.topeValorContrato);
    favorCedente.addValidators(this.topeValorContrato);
    this.form.controls.fechaSesion.addValidators(this.topeFechaCesion);
    // El tope depende del contrato: al cargarlo se revalida lo ya digitado. La fecha
    // entra aquí porque su valor por defecto es hoy: en un contrato ya vencido queda
    // fuera de rango desde el arranque, y el usuario tiene que enterarse.
    effect(() => {
      this.state.selectedContract();
      desembolsado.updateValueAndValidity({ emitEvent: false });
      favorCedente.updateValueAndValidity({ emitEvent: false });
      this.form.controls.fechaSesion.updateValueAndValidity({ emitEvent: false });
    });

    // Fecha de terminación del cedente: siempre un día antes de la fecha de cesión.
    const sesion = this.form.controls.fechaSesion;
    const terminacionCedente = this.form.controls.fechaTerminacionCedente;
    sesion.valueChanges.pipe(startWith(sesion.value), takeUntilDestroyed()).subscribe(v => {
      terminacionCedente.setValue(v ? addDaysToDate(v, -1) : '', { emitEvent: false });
    });

    // Considerando Adicional: misma regla que Cláusula Adicional (ambos campos obligatorios al activarlo).
    const considerandoActivo = this.considerando.controls['activo'];
    const considerandoPosicion = this.considerando.controls['posicion'];
    const considerandoTexto = this.considerando.controls['texto'];
    considerandoActivo.valueChanges.pipe(startWith(considerandoActivo.value), takeUntilDestroyed()).subscribe((isActive: boolean) => {
      // Solo obligatoria si además se está pidiendo (ver MOSTRAR_POSICION_CONSIDERANDO).
      const exigirPosicion = isActive && this.MOSTRAR_POSICION_CONSIDERANDO;
      considerandoPosicion.setValidators(exigirPosicion ? [Validators.required, Validators.min(1)] : [Validators.min(1)]);
      considerandoTexto.setValidators(isActive ? [Validators.required] : []);
      considerandoPosicion.updateValueAndValidity({ emitEvent: false });
      considerandoTexto.updateValueAndValidity({ emitEvent: false });
    });
  }

  /** Al elegir un cesionario del autocomplete, se refleja en la tarjeta de datos. */
  onCesionarioSelected(assignee: Assignee): void {
    this.assignee.set(assignee);
  }

  onClear(): void {
    this.assignee.set(null);
    this.form.reset({
      fechaSolicitud: todayIso(),
      fechaExpedicionActa: todayIso(),
      fechaOficioSupervisor: todayIso(),
      fechaOficioOrdenador: todayIso(),
      fechaSesion: todayIso()
    });
  }

  protected buildDraft(): NoveltyDraft {
    const v = this.form.getRawValue();
    const draft: CesionDraft = {
      type: NoveltyType.ASSIGNMENT,
      solicitud: {
        fechaSolicitud: v.fechaSolicitud ?? '',
        fechaExpedicionActa: v.fechaExpedicionActa ?? '',
        numOficioSupervisor: v.numOficioSupervisor ?? '',
        fechaOficioSupervisor: v.fechaOficioSupervisor ?? '',
        numOficioOrdenador: v.numOficioOrdenador ?? '',
        fechaOficioOrdenador: v.fechaOficioOrdenador ?? ''
      },
      fechaSesion: v.fechaSesion ?? '',
      fechaTerminacionCedente: v.fechaTerminacionCedente ?? '',
      valorDesembolsado: v.valorDesembolsado ?? null,
      valorFavorCedente: v.valorFavorCedente ?? null,
      diasFaltantes: v.diasFaltantes ?? null,
      cedulaCesionario: v.cedulaCesionario ?? '',
      cesionario: this.assignee() ?? undefined,
      considerando: v.considerando as CesionDraft['considerando'],
      clausula: v.clausula as CesionDraft['clausula']
    };
    return draft;
  }

  protected buildSummary(): NoveltySummaryItem[] {
    const c = this.state.selectedContract();
    const v = this.form.getRawValue();
    return [
      { label: 'Cedente', value: c?.contractorName ?? '' },
      { label: 'Cesionario', value: this.assignee()?.name ?? '' },
      { label: 'Ordenador del Gasto', value: c?.spendingManager ?? '' },
      { label: 'Supervisor', value: c?.supervisor ?? '' },
      { label: 'Fecha de Cesión', value: toDisplayDate(v.fechaSesion) },
      { label: 'Fecha de Terminación del Cedente', value: toDisplayDate(v.fechaTerminacionCedente) },
      { label: 'Saldo a favor del Cesionario', value: this.saldoCesionarioTexto(), highlight: true }
    ];
  }
}
