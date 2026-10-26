import { Component, computed, input } from '@angular/core';

export type FeedbackVariant = 'success' | 'error';

/**
 * Tarjeta de feedback a página completa (éxito/error). Icono circular animado,
 * título y mensaje. Slots: [details] (caja de detalle), [actions] (botones en fila)
 * y contenido por defecto (debajo de las acciones, p. ej. un enlace secundario).
 */
@Component({
  selector: 'app-feedback-card',
  standalone: true,
  styles: [`.icon-filled { font-variation-settings: 'FILL' 1; }`],
  template: `
    <main class="flex-grow flex items-center justify-center px-container-margin-mobile md:px-container-margin-desktop py-stack-lg min-h-[70vh]">
      <div class="w-full max-w-2xl">
        <div class="bg-surface-container-lowest rounded-xl p-stack-lg md:p-12 shadow-sm border border-outline-variant/30 flex flex-col items-center text-center">
          <!-- Icono -->
          <div class="mb-stack-lg relative flex items-center justify-center w-24 h-24">
            <div class="absolute inset-0 rounded-full animate-ping opacity-20" [class]="haloClass()"></div>
            <div class="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg" [class]="circleClass()">
              <span class="material-symbols-outlined icon-filled text-white text-5xl">{{ icon() }}</span>
            </div>
          </div>

          <h1 class="text-headline-lg font-headline-lg mb-stack-sm" [class]="titleClass()">{{ title() }}</h1>
          <p class="text-body-lg font-body-lg text-on-surface-variant max-w-md mb-stack-lg">{{ message() }}</p>

          <ng-content select="[details]" />

          <div class="w-full flex flex-col sm:flex-row gap-stack-md justify-center">
            <ng-content select="[actions]" />
          </div>

          <ng-content />
        </div>
      </div>
    </main>
  `
})
export class FeedbackCardComponent {
  readonly variant = input<FeedbackVariant>('success');
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly message = input.required<string>();

  protected readonly circleClass = computed(() =>
    this.variant() === 'success' ? 'bg-green-500' : 'bg-error'
  );
  protected readonly haloClass = computed(() =>
    this.variant() === 'success' ? 'bg-green-500' : 'bg-error'
  );
  protected readonly titleClass = computed(() =>
    this.variant() === 'success' ? 'text-primary' : 'text-on-surface'
  );
}
