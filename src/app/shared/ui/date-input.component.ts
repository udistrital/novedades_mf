import { Component, forwardRef, input } from '@angular/core';
import {
  ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR,
  ReactiveFormsModule, ValidationErrors, Validator
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { FormInputDirective } from './form-input.directive';
import { parseDisplayDate, toDisplayDate } from '../util/format.util';

/**
 * Máscara dd/mm/aaaa. Lo que ya tiene esa forma (p. ej. al corregir el día de una
 * fecha completa) se deja intacto para no mover el cursor; lo demás se rearma con
 * los dígitos, insertando las barras.
 */
function maskDate(raw: string): string {
  if (/^\d{0,2}(\/\d{0,2}(\/\d{0,4})?)?$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/**
 * Campo de fecha que se escribe y se muestra en dd/mm/aaaa sea cual sea el idioma del
 * navegador. Es el único campo de fecha del MF: un `<input type="date">` dibuja la fecha
 * en el formato del navegador (mm/dd/aaaa en uno en inglés) e ignora el `lang` de la
 * página, así que quien escribe "01/02" pensando en el 1 de febrero guarda el 2 de enero.
 *
 * El valor del control sigue siendo `yyyy-mm-dd` ('' sin fecha completa), igual que el
 * de un input nativo, así que reglas, validaciones y payloads no cambian. El calendario
 * es el del input nativo, invisible, abierto con `showPicker()`.
 */
@Component({
  selector: 'app-date-input',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, FormInputDirective],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInputComponent), multi: true }
  ],
  template: `
    <div class="relative">
      <input appFormInput type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" maxlength="10"
        class="pr-10" [id]="inputId()" [formControl]="text" (blur)="onTouched()">
      <input #picker type="date" tabindex="-1" aria-hidden="true"
        class="absolute inset-0 opacity-0 pointer-events-none"
        [min]="min()" [max]="max()" (change)="onPick(picker.value)">
      @if (text.enabled) {
        <button type="button" aria-label="Abrir calendario" (click)="openPicker(picker)"
          class="absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant hover:text-primary">
          <mat-icon class="text-[18px] flex items-center justify-center">calendar_today</mat-icon>
        </button>
      }
    </div>
  `
})
export class DateInputComponent implements ControlValueAccessor, Validator {
  /** `id` del input visible, para el `for` del label de `app-form-field`. */
  readonly inputId = input.required<string>();
  /** Topes del calendario en yyyy-mm-dd. Como en el input nativo, no validan lo escrito: eso lo hace cada página. */
  readonly min = input('');
  readonly max = input('');

  /**
   * Lo que se ve, en dd/mm/aaaa. FormControl y no signal: `writeValue` corre dentro de
   * los `effect` de las páginas (valores por defecto), donde Angular 18 no deja escribir signals.
   */
  readonly text = new FormControl('', { nonNullable: true });

  private onChange: (iso: string) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    this.text.valueChanges.pipe(takeUntilDestroyed()).subscribe(raw => {
      const masked = maskDate(raw);
      if (masked !== raw) this.text.setValue(masked, { emitEvent: false });
      this.onChange(parseDisplayDate(masked));
    });
  }

  protected openPicker(picker: HTMLInputElement): void {
    picker.value = parseDisplayDate(this.text.value);
    picker.showPicker();
  }

  protected onPick(iso: string): void {
    this.text.setValue(iso ? toDisplayDate(iso) : '');
    this.onTouched();
  }

  writeValue(iso: string | null): void {
    this.text.setValue(iso ? toDisplayDate(iso) : '', { emitEvent: false });
  }
  registerOnChange(fn: (iso: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.text.disable({ emitEvent: false });
    else this.text.enable({ emitEvent: false });
  }

  /** Inválido si hay texto que no forma una fecha completa y existente. */
  validate(): ValidationErrors | null {
    return this.text.value && !parseDisplayDate(this.text.value) ? { fecha: true } : null;
  }
}
