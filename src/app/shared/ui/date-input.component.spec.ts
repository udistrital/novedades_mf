import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DateInputComponent } from './date-input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DateInputComponent],
  template: `<app-date-input inputId="fecha" [formControl]="fecha" />`
})
class HostComponent {
  readonly fecha = new FormControl('2026-10-13');
}

/** Se escribe y se ve en dd/mm/aaaa sea cual sea el idioma del navegador; el control sigue en yyyy-mm-dd. */
describe('DateInputComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#fecha') as HTMLInputElement;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };
    return { fecha: fixture.componentInstance.fecha, input, type };
  }

  it('muestra el valor del control en dd/mm/aaaa', () => {
    expect(setup().input.value).toBe('13/10/2026');
  });

  it('lee día antes que mes: "01022026" es el 1 de febrero', () => {
    const { fecha, input, type } = setup();
    type('01022026');
    expect(input.value).toBe('01/02/2026');
    expect(fecha.value).toBe('2026-02-01');
  });

  it('marca inválida una fecha incompleta o inexistente', () => {
    const { fecha, type } = setup();
    type('31/02/2026');
    expect(fecha.value).toBe('');
    expect(fecha.hasError('fecha')).toBeTrue();
  });
});
