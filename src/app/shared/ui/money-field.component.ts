import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FormFieldComponent } from './form-field.component';

/**
 * Campo monetario: label flotante + prefijo "$". Se proyectan el label
 * (`<label appFormLabel for="id">`) y el input, que debe llevar la clase `!pl-7`
 * para dejar espacio al símbolo y la directiva `appMoneyInput` (puntos de miles
 * al escribir, número limpio en el control).
 */
@Component({
  selector: 'app-money-field',
  standalone: true,
  imports: [FormFieldComponent],
  template: `
    <app-form-field [control]="control()">
      <ng-content select="[appFormLabel]" />
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span class="text-on-surface-variant text-sm">$</span>
        </div>
        <ng-content />
      </div>
    </app-form-field>
  `
})
export class MoneyFieldComponent {
  readonly control = input<AbstractControl | null>(null);
}
