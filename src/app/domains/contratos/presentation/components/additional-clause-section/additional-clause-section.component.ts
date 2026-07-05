import { Component, DestroyRef, inject, input, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToggleSectionComponent } from '../../../../../shared/ui/toggle-section.component';
import { FormFieldComponent } from '../../../../../shared/ui/form-field.component';
import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';
import { NoNegativeNumberDirective } from '../../../../../shared/ui/no-negative-number.directive';

/**
 * Sección "Agregar Cláusula Adicional", reutilizada por todas las novedades.
 * Recibe un FormGroup con los controles `activa`, `posicion` y `texto`.
 * Al activarla, posición y texto pasan a ser obligatorios (se resuelve una sola vez
 * aquí porque las 5 vistas de novedad comparten este componente).
 */
@Component({
  selector: 'app-additional-clause-section',
  standalone: true,
  imports: [ReactiveFormsModule, ToggleSectionComponent, FormFieldComponent, FormInputDirective, NoNegativeNumberDirective],
  template: `
    <div class="border-t border-outline-variant/30 pt-stack-md" [formGroup]="group()">
      <app-toggle-section
        label="Agregar Cláusula Adicional"
        [active]="!!group().controls['activa'].value"
        (activeChange)="group().controls['activa'].setValue($event)">
        <div class="w-full md:w-1/3">
          <app-form-field
            label="Posición de la cláusula"
            for="clausula_posicion"
            [required]="!!group().controls['activa'].value"
            [control]="group().controls['posicion']">
            <input appFormInput id="clausula_posicion" type="number" min="1" step="1" placeholder="Ej. 1" formControlName="posicion">
          </app-form-field>
        </div>
        <app-form-field
          label="Cláusula Adicional al Acta"
          for="clausula_texto"
          [required]="!!group().controls['activa'].value"
          [control]="group().controls['texto']">
          <textarea appFormInput id="clausula_texto" rows="4" placeholder="Redacte aquí el texto de la cláusula adicional..." formControlName="texto"></textarea>
        </app-form-field>
      </app-toggle-section>
    </div>
  `
})
export class AdditionalClauseSectionComponent implements OnInit {
  readonly group = input.required<FormGroup>();
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const { activa, posicion, texto } = this.group().controls;
    activa.valueChanges.pipe(startWith(activa.value), takeUntilDestroyed(this.destroyRef)).subscribe((isActive: boolean) => {
      posicion.setValidators(isActive ? [Validators.required, Validators.min(1)] : [Validators.min(1)]);
      texto.setValidators(isActive ? [Validators.required] : []);
      posicion.updateValueAndValidity({ emitEvent: false });
      texto.updateValueAndValidity({ emitEvent: false });
    });
  }
}
