import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
import { MoneyFieldComponent } from '../../../../../shared/ui/money-field.component';
import { ToggleSectionComponent } from '../../../../../shared/ui/toggle-section.component';
import { DocumentPreviewControlComponent } from '../../../../../shared/ui/document-preview-control.component';
import { NoveltyFormActionsComponent } from '../../../../../shared/ui/novelty-form-actions.component';
import { formatCop } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { AdicionProrrogaDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';

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
    MoneyFieldComponent,
    ToggleSectionComponent,
    DocumentPreviewControlComponent,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-adicion-prorroga.component.html'
})
export class CrearAdicionProrrogaComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Adición y/o Prórroga';
  readonly vigencias = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'];

  readonly form = this.fb.group({
    solicitud: this.fb.group({
      numSolicitud: [''],
      fechaSolicitud: [''],
      numOficio: [''],
      fechaOficio: [''],
      fechaActa: ['']
    }),
    adicion: this.fb.group({
      activa: [true],
      numCdp: [''],
      vigencia: ['2026'],
      valorAdicional: [null as number | null],
      fechaAdicion: ['']
    }),
    prorroga: this.fb.group({
      activa: [false],
      tiempoDias: [null as number | null],
      fechaProrroga: ['']
    }),
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly nuevoValor = computed(() => {
    const base = this.state.selectedContract()?.totalValue ?? 0;
    const add = Number(this.formValue()?.adicion?.valorAdicional) || 0;
    return base + add;
  });

  get solicitud(): FormGroup { return this.form.get('solicitud') as FormGroup; }
  get adicion(): FormGroup { return this.form.get('adicion') as FormGroup; }
  get prorroga(): FormGroup { return this.form.get('prorroga') as FormGroup; }
  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  onClear(): void {
    this.form.reset({ adicion: { activa: true, vigencia: '2026' } });
  }

  protected buildDraft(): NoveltyDraft {
    return { type: NoveltyType.ADDITION_EXTENSION, ...this.form.getRawValue() } as AdicionProrrogaDraft;
  }

  protected buildSummary(): NoveltySummaryItem[] {
    const c = this.state.selectedContract();
    return [
      { label: 'Contratista', value: c?.contractorName ?? '' },
      { label: 'Ordenador del Gasto', value: c?.spendingManager ?? '' },
      { label: 'Nuevo Valor del Contrato', value: formatCop(this.nuevoValor()), highlight: true },
      { label: 'Nuevo Plazo', value: c?.initialTerm ?? '' }
    ];
  }
}
