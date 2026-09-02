import { Component, forwardRef, inject, input, output } from '@angular/core';
import {
  ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR,
  ReactiveFormsModule, ValidationErrors, Validator
} from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

import { FormInputDirective } from '../../../../../shared/ui/form-input.directive';
import { ContractStateService } from '../../../application/contract-state.service';
import { Assignee } from '../../../domain/models/assignee.model';

/**
 * Autocomplete de contratista/cesionario: a medida que se escribe la cédula muestra
 * en tiempo real un dropdown con cédula y nombre. Usa MatAutocomplete (teclado + a11y)
 * e integra con formularios reactivos vía ControlValueAccessor — el valor del control
 * es la cédula seleccionada/escrita.
 */
@Component({
  selector: 'app-contractor-autocomplete',
  standalone: true,
  imports: [ReactiveFormsModule, MatAutocompleteModule, FormInputDirective],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ContractorAutocompleteComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => ContractorAutocompleteComponent), multi: true }
  ],
  template: `
    <input appFormInput type="text" autocomplete="off"
      [formControl]="query"
      [placeholder]="placeholder()"
      [matAutocomplete]="auto">
    <mat-autocomplete #auto="matAutocomplete" [displayWith]="display" (optionSelected)="onSelected($event)">
      @for (o of opciones(); track o.documentNumber) {
        <mat-option [value]="o">
          <span class="block leading-tight text-on-surface">{{ o.documentNumber }}</span>
          <span class="block leading-tight text-on-surface-variant text-xs">{{ o.name }}</span>
        </mat-option>
      }
    </mat-autocomplete>
  `
})
export class ContractorAutocompleteComponent implements ControlValueAccessor, Validator {
  private readonly state = inject(ContractStateService);

  readonly placeholder = input('Buscar por número de documento...');
  /** Restringe las opciones a personas naturales (el cesionario debe serlo, requerimientos §5.3). */
  readonly soloNaturales = input(false);
  readonly selected = output<Assignee>();

  readonly query = new FormControl<string | Assignee>('', { nonNullable: true });

  /** true solo mientras el valor actual proviene de una selección real del dropdown. */
  private isRealSelection = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  readonly opciones = toSignal(
    this.query.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => typeof value === 'string' && value.trim().length >= 3
        ? this.state.searchContractors(value.trim())
        : of([] as Assignee[])),
      map(list => this.soloNaturales() ? list.filter(a => a.documentType !== 'NIT') : list)
    ),
    { initialValue: [] as Assignee[] }
  );

  constructor() {
    // El valor propagado al form padre es siempre la cédula (string); `isRealSelection`
    // marca si ese valor vino de elegir una opción (objeto) o de texto libre (string).
    this.query.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      this.isRealSelection = typeof value !== 'string';
      this.onChange(typeof value === 'string' ? value : value.documentNumber);
    });
  }

  onSelected(event: MatAutocompleteSelectedEvent): void {
    this.onTouched();
    this.selected.emit(event.option.value as Assignee);
  }

  // Muestra la cédula tanto si el valor es texto escrito como un contratista seleccionado.
  display = (value: string | Assignee): string =>
    typeof value === 'string' ? value : (value?.documentNumber ?? '');

  writeValue(value: string | null): void {
    this.isRealSelection = false;
    this.query.setValue(value ?? '', { emitEvent: false });
  }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.query.disable({ emitEvent: false });
    else this.query.enable({ emitEvent: false });
  }

  /** Inválido si hay texto pero no corresponde a una selección real de la lista. */
  validate(): ValidationErrors | null {
    return this.query.value && !this.isRealSelection ? { notSelected: true } : null;
  }
}
