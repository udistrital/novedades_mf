import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateInputComponent } from '../../../../shared/ui/date-input.component';
import { focusFirstInvalid, volverAlContrato } from './create-novelty-page.base';

/**
 * Al volver al panel, el contrato recién tramitado viaja en la URL: es lo que hace
 * que el listado se repueble aunque el estado en memoria esté vacío (entrada por
 * enlace directo o recarga), que era cuando el panel aparecía en blanco.
 */
describe('volverAlContrato', () => {
  it('parte el id compuesto en número y vigencia', () => {
    expect(volverAlContrato('653_2025')).toEqual({ contrato: '653', vigencia: '2025' });
  });

  it('sin vigencia manda el número solo, no "undefined"', () => {
    expect(volverAlContrato('653')).toEqual({ contrato: '653', vigencia: '' });
  });

  it('sin id no manda parámetros: el panel se queda como estaba', () => {
    expect(volverAlContrato('')).toEqual({});
  });
});

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DateInputComponent],
  template: `
    <form [formGroup]="form">
      <app-date-input inputId="fecha" formControlName="fecha" />
      <input id="numero" formControlName="numero">
    </form>`
})
class FormHostComponent {
  readonly form = new FormGroup({
    fecha: new FormControl('', Validators.required),
    numero: new FormControl('', Validators.required)
  });
}

/**
 * Al enviar un formulario inválido el foco va al primer campo en pantalla. Una fecha
 * se saltaba: Angular marca inválido el host de `app-date-input`, no su input.
 */
describe('focusFirstInvalid', () => {
  it('enfoca el input de una fecha inválida cuando es el primer campo', () => {
    const fixture = TestBed.createComponent(FormHostComponent);
    fixture.detectChanges();
    focusFirstInvalid(fixture.nativeElement.querySelector('form'));
    expect(document.activeElement?.id).toBe('fecha');
  });
});
