import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CreateNoveltyPage } from '../create-novelty-page.base';
import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
import { AdditionalClauseSectionComponent } from '../../components/additional-clause-section/additional-clause-section.component';
import { ConfirmNoveltyModalComponent, NoveltySummaryItem } from '../../components/confirm-novelty-modal/confirm-novelty-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { FormFieldComponent } from '../../../../../shared/ui/form-field.component';
import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';
import { DocumentPreviewControlComponent } from '../../../../../shared/ui/document-preview-control.component';
import { NoveltyFormActionsComponent } from '../../../../../shared/ui/novelty-form-actions.component';
import { toDisplayDate } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { SuspensionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';

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
    DocumentPreviewControlComponent,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-suspension.component.html'
})
export class CrearSuspensionComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Suspensión';

  readonly form = this.fb.group({
    fechaSolicitud: [''],
    fechaExpedicionActa: [''],
    numOficioSupervisor: [''],
    fechaOficioSupervisor: [''],
    numOficioOrdenador: [''],
    fechaOficioOrdenador: [''],
    periodoDias: [null as number | null],
    fechaInicio: [''],
    fechaFin: [{ value: '', disabled: true }],
    fechaReinicio: [{ value: '', disabled: true }],
    motivo: [''],
    clausula: this.fb.group({
      activa: [false],
      posicion: [null as number | null],
      texto: ['']
    })
  });

  get clausula(): FormGroup { return this.form.get('clausula') as FormGroup; }

  onClear(): void {
    this.form.reset();
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
