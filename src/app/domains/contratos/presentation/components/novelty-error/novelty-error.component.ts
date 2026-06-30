import { Component, computed, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackCardComponent } from '../../../../../shared/ui/feedback-card.component';

/** Pantalla de error tras fallar la creación o anulación de una novedad. */
@Component({
  selector: 'app-novelty-error',
  standalone: true,
  imports: [MatIconModule, FeedbackCardComponent],
  template: `
    <app-feedback-card
      variant="error"
      icon="error"
      [title]="title()"
      [message]="displayMessage()">

      <div details class="w-full bg-error-container/20 border-l-4 border-error p-stack-md rounded-r-lg mb-stack-lg text-left">
        <div class="flex items-start gap-stack-sm">
          <mat-icon class="text-error mt-0.5 flex items-center justify-center">info</mat-icon>
          <div>
            <span class="block text-label-lg font-label-lg text-on-error-container font-bold">Código de error: {{ errorCode() }}</span>
            <span class="block text-body-md font-body-md text-on-surface-variant">{{ errorDetail() }}</span>
          </div>
        </div>
      </div>

      <button
        actions
        type="button"
        (click)="retry.emit()"
        class="bg-primary hover:bg-primary-container text-white px-8 py-3 rounded-lg font-title-md flex items-center justify-center gap-stack-sm transition-all shadow-md active:scale-95">
        <mat-icon class="flex items-center justify-center">refresh</mat-icon> Reintentar
      </button>
      <button
        actions
        type="button"
        class="border border-primary text-primary hover:bg-primary/5 px-8 py-3 rounded-lg font-title-md flex items-center justify-center gap-stack-sm transition-all active:scale-95">
        <mat-icon class="flex items-center justify-center">support_agent</mat-icon> Contactar Soporte
      </button>

      <button
        type="button"
        (click)="back.emit()"
        class="mt-stack-lg text-label-lg font-label-lg text-on-surface-variant hover:text-primary underline underline-offset-4 transition-colors">
        Volver al Panel de Gestión
      </button>
    </app-feedback-card>
  `
})
export class NoveltyErrorComponent {
  readonly noveltyName = input.required<string>();
  readonly errorCode = input('500-SRV-LT');
  readonly errorDetail = input('El servidor de trámites legales de la Universidad no respondió a tiempo.');
  /** Título; por defecto el de creación. */
  readonly title = input('Error al Crear Novedad');
  /** Mensaje; si se omite, se genera a partir de `noveltyName` (caso creación). */
  readonly message = input('');

  readonly retry = output<void>();
  readonly back = output<void>();

  protected readonly displayMessage = computed(() =>
    this.message() ||
    `No se pudo procesar la solicitud de creación de la novedad de ${this.noveltyName().toLowerCase()} en este momento. Por favor, intente de nuevo más tarde.`
  );
}
