import { Component, input, output } from '@angular/core';

/** Acciones inferiores del formulario: Limpiar / Crear Novedad. */
@Component({
  selector: 'app-novelty-form-actions',
  standalone: true,
  template: `
    <div class="flex justify-end gap-4 mt-stack-sm">
      <button
        type="button"
        (click)="clear.emit()"
        class="px-6 py-2 border border-outline text-on-surface-variant rounded hover:bg-surface-variant transition-colors font-label-lg text-label-lg">
        Limpiar
      </button>
      <button
        type="submit"
        [disabled]="submitting()"
        class="px-6 py-2 bg-primary text-on-primary rounded hover:bg-primary-container transition-colors font-label-lg text-label-lg shadow-sm disabled:opacity-50">
        {{ submitLabel() }}
      </button>
    </div>
  `
})
export class NoveltyFormActionsComponent {
  readonly submitLabel = input('Crear Novedad');
  readonly submitting = input(false);
  readonly clear = output<void>();
}
