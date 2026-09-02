import { Component, computed, effect, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

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
import { addDaysToTerm, formatCop, formatCopWords, todayIso } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { AdicionProrrogaDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import {
  currentContractValue,
  maxAdditionValue,
  maxExtensionDays
} from '../../../domain/contract.rules';

/**
 * Página de creación de la novedad de Adición y Prórroga: incrementa el valor
 * del contrato y extiende su plazo (ambas secciones son obligatorias por
 * requerimiento actualizado — la novedad siempre se tramita completa).
 *
 * Topes normativos (requerimientos §5.2): la adición no puede superar el 50 %
 * del valor vigente (base + adiciones previas) ni la prórroga el 50 % del
 * plazo vigente en días (mes = 30 días). Nuevo valor y nuevo plazo parten de
 * los acumulados históricos, no del dato base del contrato.
 */
@Component({
  selector: 'app-crear-adicion-prorroga',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
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
  templateUrl: './crear-adicion-prorroga.component.html'
})
export class CrearAdicionProrrogaComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Adición y Prórroga';
  /** Vigencias del catálogo del backend (ver `ContractStateService.vigencias`). */
  readonly vigencias = this.state.vigencias;

  readonly form = this.fb.group({
    solicitud: this.fb.group({
      numSolicitud: ['', Validators.required],
      fechaSolicitud: [todayIso()],
      numOficio: ['', Validators.required],
      fechaOficio: [todayIso()],
      fechaActa: [todayIso()]
    }),
    adicion: this.fb.group({
      // El número de CDP es un IDENTIFICADOR, no una cantidad: puede traer letras y
      // guiones ("CDP-001"). Con `type="number"` el navegador descartaba en silencio
      // todo lo que no fuera un número —el usuario veía su texto y el control llegaba
      // vacío—, así que el acta imprimía el CDP en blanco. Sin `Validators.min`, que
      // no aplica a una cadena.
      numCdp: [''],
      vigencia: [this.vigencias()[0]],
      valorAdicional: [null as number | null, [Validators.required, Validators.min(1)]],
      fechaAdicion: [todayIso()]
    }),
    prorroga: this.fb.group({
      tiempoDias: [null as number | null, [Validators.required, Validators.min(1)]],
      fechaProrroga: [todayIso()]
    }),
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  /** Valor vigente del contrato: base + adiciones históricas (MIG-004). */
  readonly valorVigente = computed(() => {
    const c = this.state.selectedContract();
    return c ? currentContractValue(c) : 0;
  });

  /**
   * Valor de la adición digitado, recortado al tope legal.
   *
   * Las proyecciones de abajo ("Nuevo Valor", resumen del modal) se calculan sobre
   * este valor y no sobre el crudo: el contrato no puede llegar más allá del vigente
   * más el 50 %, así que mostrar una cifra mayor proyectaría un contrato imposible.
   * El campo, en cambio, conserva lo digitado y muestra el error del tope.
   */
  private readonly adicionTopeada = computed(() => {
    const c = this.state.selectedContract();
    const valor = Math.max(Number(this.formValue()?.adicion?.valorAdicional) || 0, 0);
    // Se trunca a pesos enteros: el tope es la mitad del valor vigente y puede caer
    // en media unidad, y ahí el número (que redondea) y las letras (que truncan)
    // mostrarían cifras distintas para el mismo campo.
    return Math.floor(c ? Math.min(valor, maxAdditionValue(c)) : valor);
  });

  /** Días de prórroga digitados, recortados al tope legal (mismo criterio que `adicionTopeada`). */
  private readonly prorrogaTopeada = computed(() => {
    const c = this.state.selectedContract();
    const dias = Math.max(Number(this.formValue()?.prorroga?.tiempoDias) || 0, 0);
    return c ? Math.min(dias, maxExtensionDays(c)) : dias;
  });

  readonly nuevoValor = computed(() => this.valorVigente() + this.adicionTopeada());

  readonly nuevoValorEnLetras = computed(() => formatCopWords(this.nuevoValor()));

  /**
   * Valor de la adición en letras. **Desaparece al superar el tope**: el campo ya
   * muestra el error con el máximo permitido, y repetir en letras una cifra que no
   * se va a poder registrar solo la confirma.
   */
  readonly valorAdicionalEnLetras = computed(() => {
    const c = this.state.selectedContract();
    const valor = Number(this.formValue()?.adicion?.valorAdicional) || 0;
    if (valor <= 0 || (c && valor > maxAdditionValue(c))) return '';
    return formatCopWords(valor);
  });

  readonly nuevoPlazo = computed(() => {
    const c = this.state.selectedContract();
    // Prórrogas históricas + la nueva (topeada), sobre el plazo inicial (mes = 30 días).
    const diasHistoricos = c?.novelties.reduce((s, n) => s + (n.diasProrroga ?? 0), 0) ?? 0;
    return addDaysToTerm(c?.initialTerm, diasHistoricos + this.prorrogaTopeada());
  });

  /** El legado exige un Ordenador del Gasto asignado para tramitar esta novedad (§5.2). */
  readonly sinOrdenadorGasto = computed(() => !this.state.selectedContract()?.spendingManager?.trim());

  get solicitud(): FormGroup { return this.form.get('solicitud') as FormGroup; }
  get adicion(): FormGroup { return this.form.get('adicion') as FormGroup; }
  get prorroga(): FormGroup { return this.form.get('prorroga') as FormGroup; }
  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  /** Tope de adición: 50 % del valor vigente (TOPE_ADICION del dominio). */
  private readonly topeAdicionValidator = (ctrl: AbstractControl): ValidationErrors | null => {
    const c = this.state.selectedContract();
    const v = Number(ctrl.value);
    if (!c || !Number.isFinite(v) || v <= 0) return null;
    const max = maxAdditionValue(c);
    return v > max ? { topeAdicion: { max: formatCop(max) } } : null;
  };

  /** Tope de prórroga: 50 % del plazo vigente en días (TOPE_PRORROGA del dominio). */
  private readonly topeProrrogaValidator = (ctrl: AbstractControl): ValidationErrors | null => {
    const c = this.state.selectedContract();
    const dias = Number(ctrl.value);
    if (!c || !Number.isFinite(dias) || dias <= 0) return null;
    const max = maxExtensionDays(c);
    return dias > max ? { topeProrroga: { max } } : null;
  };

  constructor() {
    super();

    const valorAdicional = this.adicion.controls['valorAdicional'];
    const tiempoDias = this.prorroga.controls['tiempoDias'];
    valorAdicional.addValidators(this.topeAdicionValidator);
    tiempoDias.addValidators(this.topeProrrogaValidator);

    // Los topes dependen del contrato: al cargarlo se revalida lo ya digitado.
    effect(() => {
      this.state.selectedContract();
      valorAdicional.updateValueAndValidity({ emitEvent: false });
      tiempoDias.updateValueAndValidity({ emitEvent: false });
    });
  }

  onClear(): void {
    this.form.reset({
      solicitud: { fechaSolicitud: todayIso(), fechaOficio: todayIso(), fechaActa: todayIso() },
      adicion: { vigencia: this.vigencias()[0], fechaAdicion: todayIso() },
      prorroga: { fechaProrroga: todayIso() }
    });
  }

  protected buildDraft(): NoveltyDraft {
    const v = this.form.getRawValue();
    // Ambas secciones son obligatorias: la novedad siempre viaja como adición+prórroga.
    const draft: AdicionProrrogaDraft = {
      type: NoveltyType.ADDITION_EXTENSION,
      solicitud: v.solicitud as AdicionProrrogaDraft['solicitud'],
      adicion: { ...(v.adicion as Omit<AdicionProrrogaDraft['adicion'], 'activa'>), activa: true },
      prorroga: { ...(v.prorroga as Omit<AdicionProrrogaDraft['prorroga'], 'activa'>), activa: true },
      clausula: v.clausula as AdicionProrrogaDraft['clausula']
    };
    return draft;
  }

  protected buildSummary(): NoveltySummaryItem[] {
    const c = this.state.selectedContract();
    return [
      { label: 'Contratista', value: c?.contractorName ?? '' },
      { label: 'Ordenador del Gasto', value: c?.spendingManager?.trim() || 'Sin Ordenador del Gasto asignado' },
      { label: 'Nuevo Valor del Contrato', value: formatCop(this.nuevoValor()), highlight: true },
      { label: 'Nuevo Plazo', value: this.nuevoPlazo() }
    ];
  }
}
