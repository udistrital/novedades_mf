import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { CreateNoveltyPage } from '../create-novelty-page.base';
import { NoveltyPageLayoutComponent } from '../../components/novelty-page-layout/novelty-page-layout.component';
import { AdditionalClauseSectionComponent } from '../../components/additional-clause-section/additional-clause-section.component';
import { AssigneeInfoCardComponent } from '../../components/assignee-info-card/assignee-info-card.component';
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
import { toDisplayDate } from '../../../../../shared/util/format.util';

import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { CesionDraft, NoveltyDraft } from '../../../domain/models/novelty-draft.model';
import { Assignee } from '../../../domain/models/assignee.model';

@Component({
  selector: 'app-crear-cesion',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatIconModule,
    NoveltyPageLayoutComponent,
    AdditionalClauseSectionComponent,
    AssigneeInfoCardComponent,
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
  templateUrl: './crear-cesion.component.html'
})
export class CrearCesionComponent extends CreateNoveltyPage {
  private readonly fb = inject(FormBuilder);

  readonly noveltyName = 'Cesión';

  // Mock: en producción se resolvería al buscar por cédula del cesionario.
  readonly assignee = signal<Assignee>({
    name: 'CAMILO ANDRES GARZON SOGAMOSO',
    documentNumber: '1012385339',
    documentType: 'CÉDULA DE CIUDADANÍA'
  });

  readonly form = this.fb.group({
    fechaSolicitud: [''],
    fechaExpedicionActa: [''],
    numOficioSupervisor: [''],
    fechaOficioSupervisor: [''],
    numOficioOrdenador: [''],
    fechaOficioOrdenador: [''],
    fechaSesion: [''],
    fechaTerminacionCedente: [{ value: '', disabled: true }],
    valorDesembolsado: [null as number | null],
    valorFavorCedente: [null as number | null],
    diasFaltantes: [null as number | null],
    cedulaCesionario: [''],
    considerando: this.fb.group({
      activo: [false],
      posicion: [null as number | null],
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

  onClear(): void {
    this.form.reset();
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
      { label: 'Cesionario', value: this.assignee().name },
      { label: 'Ordenador del Gasto', value: c?.spendingManager ?? '' },
      { label: 'Supervisor', value: c?.supervisor ?? '' },
      { label: 'Fecha de Cesión', value: toDisplayDate(v.fechaSesion) },
      { label: 'Fecha de Terminación del Cedente', value: toDisplayDate(v.fechaTerminacionCedente) }
    ];
  }
}
