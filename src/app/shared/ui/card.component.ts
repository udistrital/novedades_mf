import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type CardVariant = 'form' | 'context';

/**
 * Tarjeta con header opcional (icono + título). Dos variantes:
 * - 'context': columna izquierda (Información del Contrato / Cesionario).
 * - 'form': columna derecha (secciones del formulario).
 */
@Component({
  selector: 'app-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div [class]="containerClasses()">
      @if (title()) {
        <div [class]="headerClasses()">
          @if (icon()) {
            <mat-icon class="flex items-center justify-center">{{ icon() }}</mat-icon>
          }
          <span>{{ title() }}</span>
        </div>
      }
      <ng-content />
    </div>
  `
})
export class CardComponent {
  readonly title = input<string>();
  readonly icon = input<string>();
  readonly variant = input<CardVariant>('form');

  protected readonly containerClasses = computed(() =>
    this.variant() === 'context'
      ? 'bg-surface-container-low rounded-lg p-stack-lg shadow-sm border border-surface-variant flex flex-col gap-stack-md'
      : 'bg-surface-container-lowest rounded-lg p-stack-lg shadow-sm border border-outline-variant/50'
  );

  protected readonly headerClasses = computed(() =>
    this.variant() === 'context'
      ? 'font-title-md text-title-md text-primary border-b border-surface-variant pb-2 flex items-center gap-2'
      : 'font-title-md text-title-md mb-stack-md flex items-center gap-2 text-on-surface [&>mat-icon]:text-primary'
  );
}
