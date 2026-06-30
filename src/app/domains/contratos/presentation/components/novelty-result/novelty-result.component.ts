import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackCardComponent } from '../../../../../shared/ui/feedback-card.component';

/** Pantalla de éxito tras crear o anular una novedad. */
@Component({
  selector: 'app-novelty-result',
  standalone: true,
  imports: [MatIconModule, FeedbackCardComponent],
  template: `
    <app-feedback-card
      variant="success"
      icon="check_circle"
      [title]="title()"
      [message]="displayMessage()">

      <div details class="w-full bg-surface-container-low border border-outline-variant rounded-lg p-stack-md text-left mb-stack-lg">
        <div class="border-b border-outline-variant/30 pb-stack-sm mb-stack-sm">
          <span class="text-label-sm font-label-sm uppercase tracking-wider text-on-surface-variant/70">Resumen del Proceso</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
          <div>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Contrato Afectado</p>
            <p class="text-title-md font-title-md text-on-surface">Contrato No. {{ contractNumber() }}</p>
          </div>
          <div>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Tipo de Novedad</p>
            <p class="text-title-md font-title-md text-on-surface">{{ noveltyName() }}</p>
          </div>
          <div>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Fecha de Ejecución</p>
            <p class="text-body-md font-body-md text-on-surface">{{ executedAt() }}</p>
          </div>
          <div>
            <p class="text-label-sm font-label-sm text-on-surface-variant">Responsable</p>
            <p class="text-body-md font-body-md text-on-surface">{{ responsible() }}</p>
          </div>
        </div>
      </div>

      <button
        actions
        type="button"
        (click)="back.emit()"
        class="bg-primary hover:bg-primary-container text-on-primary font-bold px-8 py-3 rounded transition-all flex items-center justify-center gap-2 shadow-md">
        <mat-icon class="flex items-center justify-center">history</mat-icon>
        <span>Volver al Seguimiento</span>
      </button>
    </app-feedback-card>
  `
})
export class NoveltyResultComponent {
  readonly noveltyName = input.required<string>();
  readonly contractNumber = input.required<string>();
  readonly executedAt = input.required<string>();
  readonly responsible = input.required<string>();
  /** Título; por defecto el de creación. */
  readonly title = input('Novedad Creada Exitosamente');
  /** Mensaje; si se omite, se genera a partir de `noveltyName` (caso creación). */
  readonly message = input('');

  readonly back = output<void>();

  protected readonly displayMessage = computed(() =>
    this.message() ||
    `La solicitud de creación de novedad de ${this.noveltyName().toLowerCase()} ha sido procesada correctamente por el sistema de gestión jurídica.`
  );
}
