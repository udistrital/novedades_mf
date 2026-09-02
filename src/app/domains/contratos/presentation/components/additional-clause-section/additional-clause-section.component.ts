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
        <!--
          Posición de la cláusula: OCULTA de la vista (2026-08-24), no eliminada.
          El control sigue en el FormGroup y viaja en el draft; solo se dejó de
          pedir al usuario. Se reactiva poniendo MOSTRAR_POSICION en true.
          (Sin comillas invertidas en este comentario: cerrarían el template.)
        -->
        @if (MOSTRAR_POSICION) {
          <div class="w-full md:w-1/3">
            <app-form-field
              label="Posición de la cláusula"
              for="clausula_posicion"
              [required]="!!group().controls['activa'].value"
              [control]="group().controls['posicion']">
              <input appFormInput id="clausula_posicion" type="number" min="1" step="1" placeholder="Ej. 1" formControlName="posicion">
            </app-form-field>
          </div>
        }
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

  /**
   * Interruptor de la posición de la cláusula, hoy **apagado** por decisión de
   * negocio: el campo no se le pide al usuario, pero el control, el draft y el
   * payload siguen intactos. Ponerlo en `true` restituye el campo y su
   * obligatoriedad, sin más cambios.
   */
  protected readonly MOSTRAR_POSICION = false;

  ngOnInit(): void {
    const { activa, posicion, texto } = this.group().controls;
    activa.valueChanges.pipe(startWith(activa.value), takeUntilDestroyed(this.destroyRef)).subscribe((isActive: boolean) => {
      // `posicion` solo es obligatoria si además se está pidiendo: exigir un campo
      // que no se ve dejaría el formulario inválido sin nada que el usuario pueda
      // corregir.
      const exigirPosicion = isActive && this.MOSTRAR_POSICION;
      posicion.setValidators(exigirPosicion ? [Validators.required, Validators.min(1)] : [Validators.min(1)]);
      texto.setValidators(isActive ? [Validators.required] : []);
      posicion.updateValueAndValidity({ emitEvent: false });
      texto.updateValueAndValidity({ emitEvent: false });
    });
  }
}
