import { Directive, ElementRef, HostListener, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Pesos enteros con puntos de miles, igual que `formatCop` y el acta: 1500000 → 1.500.000. */
function formatPesos(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

/**
 * Campo de dinero: muestra los pesos con puntos de miles mientras se escriben
 * (1.500.000) y entrega al control el número limpio (1500000), que es lo que viaja al
 * backend. Solo pesos enteros: lo que no es dígito se descarta, así que tampoco hay
 * negativos. Va en el `<input>` que se proyecta en `app-money-field`.
 */
@Directive({
  selector: 'input[appMoneyInput]',
  standalone: true,
  host: { inputmode: 'numeric', autocomplete: 'off' },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInputDirective), multi: true }]
})
export class MoneyInputDirective implements ControlValueAccessor {
  private readonly input: HTMLInputElement = inject(ElementRef).nativeElement;
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  @HostListener('input')
  onInput(): void {
    const { value, selectionStart } = this.input;
    const digitosAntes = value.slice(0, selectionStart ?? value.length).replace(/\D/g, '').length;
    // 15 dígitos: lo máximo que un `number` guarda sin perder precisión.
    const digitos = value.replace(/\D/g, '').slice(0, 15);
    const pesos = digitos ? Number(digitos) : null;
    this.input.value = pesos === null ? '' : formatPesos(pesos);
    // El cursor vuelve detrás del mismo dígito: si no, corregir uno del medio lo manda al final.
    let pos = 0;
    for (let vistos = 0; vistos < digitosAntes && pos < this.input.value.length; pos++) {
      if (/\d/.test(this.input.value[pos])) vistos++;
    }
    this.input.setSelectionRange(pos, pos);
    this.onChange(pesos);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  /**
   * ponytail: un valor con centavos escrito por código (el saldo que sugiere la
   * terminación, si el valor del contrato los trae) se ve redondeado pero el control lo
   * guarda exacto, para que el balance que valida el servicio cuadre. Si el usuario lo
   * reescribe queda en pesos enteros; habría que admitir decimales si aparecen contratos así.
   */
  writeValue(value: number | null): void {
    this.input.value = value === null || value === undefined ? '' : formatPesos(Number(value));
  }
  registerOnChange(fn: (value: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.input.disabled = isDisabled; }
}
