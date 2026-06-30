import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { CreateNoveltyPage } from '../create-novelty-page.base';
import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
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
import { ReinicioDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';

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
    DocumentPreviewControlComponent,
    NoveltyFormActionsComponent
  ],
  templateUrl: './crear-reinicio.component.html'
})
export class CrearReinicioComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Reinicio';

  readonly form = this.fb.group({
    fechaSolicitud: [''],
    fechaExpedicionActa: [''],
    // Datos de la suspensión vigente: el inicio y la fecha de reinicio son de solo lectura.
    fechaInicioSuspension: [{ value: '', disabled: true }],
    fechaFinSuspension: [''],
    periodoDias: [null as number | null],
    fechaReinicio: [{ value: '', disabled: true }]
  });

  onClear(): void {
    this.form.reset();
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
