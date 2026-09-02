import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { toDisplayDate } from '../util/format.util';

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
      @if (mostrarError()) {
        <p class="text-error text-xs mt-1">{{ errorMessage() }}</p>
      }
    </div>
  `
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly for = input<string>();
  readonly required = input(false);
  /** Control asociado, para mostrar su mensaje de error cuando corresponda (ver `mostrarError`). */
  readonly control = input<AbstractControl | null>(null);

  /**
   * ¿Se muestra el error? Cuando el control es inválido y el usuario ya
   * **escribió** (`dirty`) o **salió** del campo (`touched`).
   *
   * `dirty` es lo que hace que el mensaje salga en el momento en que el valor deja
   * de ser válido y no al hacer clic en otro lado: con solo `touched`, un tope
   * superado quedaba invisible mientras el usuario seguía en el campo, que es
   * justo cuando le sirve saberlo. `touched` se conserva porque el submit llama
   * `markAllAsTouched()`, y así los obligatorios vacíos —nunca tocados ni
   * escritos— también se marcan al intentar enviar.
   *
   * Método y no `computed()`, por la misma razón que `errorMessage()`.
   */
  mostrarError(): boolean {
    const c = this.control();
    return !!c?.invalid && (c.dirty || c.touched);
  }

  /**
   * Método normal, NO `computed()`: los errores de un `AbstractControl` mutan
   * in place sobre la misma instancia (Reactive Forms no la reemplaza), así
   * que un `computed` memoizado sobre `this.control()` nunca se invalidaría al
   * cambiar de "required" a "min"/"tope" — se releería fresco solo por la
   * casualidad de otra señal disparando CD. Como método, se reevalúa en cada
   * pase de detección de cambios, igual que `control()?.invalid/touched` ya lo hacen arriba.
   */
  errorMessage(): string {
    const errors = this.control()?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['min']) return `El valor no puede ser menor a ${errors['min'].min}.`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['dateRange']) return 'La fecha de inicio debe ser anterior a la fecha de fin (mínimo 1 día de diferencia).';
    if (errors['minDate']) return `La fecha no puede ser anterior al ${toDisplayDate(errors['minDate'].min)}.`;
    if (errors['maxDate']) return `La fecha no puede ser posterior al ${toDisplayDate(errors['maxDate'].max)}.`;
    if (errors['notSelected']) return 'Selecciona una opción de la lista.';
    if (errors['topeAdicion']) return `Supera el tope legal: máximo 50 % del valor vigente (${errors['topeAdicion'].max}).`;
    if (errors['topeProrroga']) return `Supera el tope legal: máximo 50 % del plazo vigente (${errors['topeProrroga'].max} días).`;
    if (errors['maxContractValue']) return 'El valor no puede superar el valor vigente del contrato.';
    return 'Valor inválido.';
  }
}
