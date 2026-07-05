import { Component, computed, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

/** Campo de formulario con label flotante. El control (input/select/textarea) se proyecta. */
@Component({
  selector: 'app-form-field',
  standalone: true,
  template: `
    <div class="relative">
      <label
        [attr.for]="for()"
        class="absolute -top-2 left-2 inline-block bg-surface-container-lowest px-1 font-label-sm text-label-sm text-on-surface-variant z-10">
        {{ label() }}@if (required()) {<span class="text-error"> *</span>}
      </label>
      <ng-content />
      @if (control()?.invalid && control()?.touched) {
        <p class="text-error text-xs mt-1">{{ errorMessage() }}</p>
      }
    </div>
  `
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly for = input<string>();
  readonly required = input(false);
  /** Control asociado, para mostrar el mensaje de error cuando esté inválido y haya sido tocado. */
  readonly control = input<AbstractControl | null>(null);

  readonly errorMessage = computed(() => {
    const errors = this.control()?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['min']) return 'El valor no puede ser negativo.';
    if (errors['dateRange']) return 'La fecha de inicio debe ser anterior a la fecha de fin (mínimo 1 día de diferencia).';
    if (errors['minDate']) return 'La fecha no puede ser anterior a la mínima permitida.';
    if (errors['notSelected']) return 'Selecciona una opción de la lista.';
    return 'Valor inválido.';
  });
}
