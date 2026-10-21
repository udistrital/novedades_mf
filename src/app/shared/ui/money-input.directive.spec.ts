import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MoneyInputDirective } from './money-input.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MoneyInputDirective],
  template: `<input appMoneyInput id="valor" [formControl]="valor">`
})
class HostComponent {
  readonly valor = new FormControl<number | null>(1500000);
}

/** Se ve con puntos de miles; el control (y el backend) recibe el número limpio. */
describe('MoneyInputDirective', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('#valor') as HTMLInputElement;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };
    return { valor: fixture.componentInstance.valor, input, type };
  }

  it('muestra el valor del control con puntos de miles', () => {
    expect(setup().input.value).toBe('1.500.000');
  });

  it('entrega un número sin separadores y reformatea lo escrito', () => {
    const { valor, input, type } = setup();
    type('25000000');
    expect(input.value).toBe('25.000.000');
    expect(valor.value).toBe(25_000_000);
  });

  it('descarta lo que no es dígito: ni signo, ni decimales, ni letras', () => {
    const { valor, type } = setup();
    type('-1.234,5x');
    expect(valor.value).toBe(12_345);
    type('');
    expect(valor.value).toBeNull();
  });
});
