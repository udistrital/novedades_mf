import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FormFieldComponent } from './form-field.component';

/**
 * Campo monetario: label flotante + prefijo "$". El input se proyecta y debe
 * llevar la clase `!pl-7` para dejar espacio al símbolo.
 */
@Component({
  selector: 'app-money-field',
  standalone: true,
  imports: [FormFieldComponent],
  template: `
    <app-form-field [label]="label()" [for]="for()" [required]="required()" [control]="control()">
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
  readonly label = input.required<string>();
  readonly for = input<string>();
  readonly required = input(false);
  readonly control = input<AbstractControl | null>(null);
}
