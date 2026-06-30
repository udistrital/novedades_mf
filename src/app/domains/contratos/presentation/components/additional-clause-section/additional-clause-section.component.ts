import { Component, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ToggleSectionComponent } from '../../../../../shared/ui/toggle-section.component';
import { FormFieldComponent } from '../../../../../shared/ui/form-field.component';
import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';

/**
 * Sección "Agregar Cláusula Adicional", reutilizada por todas las novedades.
 * Recibe un FormGroup con los controles `activa`, `posicion` y `texto`.
 */
@Component({
  selector: 'app-additional-clause-section',
  standalone: true,
  imports: [ReactiveFormsModule, ToggleSectionComponent, FormFieldComponent, FormInputDirective],
  template: `
    <div class="border-t border-outline-variant/30 pt-stack-md" [formGroup]="group()">
      <app-toggle-section
        label="Agregar Cláusula Adicional"
        [active]="!!group().controls['activa'].value"
        (activeChange)="group().controls['activa'].setValue($event)">
        <div class="w-full md:w-1/3">
          <app-form-field label="Posición de la cláusula" for="clausula_posicion">
            <input appFormInput id="clausula_posicion" type="number" min="1" step="1" placeholder="Ej. 1" formControlName="posicion">
          </app-form-field>
        </div>
        <app-form-field label="Cláusula Adicional al Acta" for="clausula_texto">
          <textarea appFormInput id="clausula_texto" rows="4" placeholder="Redacte aquí el texto de la cláusula adicional..." formControlName="texto"></textarea>
        </app-form-field>
      </app-toggle-section>
    </div>
  `
})
export class AdditionalClauseSectionComponent {
  readonly group = input.required<FormGroup>();
}
