import { Component, input } from '@angular/core';

/** Campo de formulario con label flotante. El control (input/select/textarea) se proyecta. */
@Component({
  selector: 'app-form-field',
  standalone: true,
  template: `
    <div class="relative">
      <label
        [attr.for]="for()"
        class="absolute -top-2 left-2 inline-block bg-surface-container-lowest px-1 font-label-sm text-label-sm text-on-surface-variant z-10">
        {{ label() }}
      </label>
      <ng-content />
    </div>
  `
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly for = input<string>();
}
