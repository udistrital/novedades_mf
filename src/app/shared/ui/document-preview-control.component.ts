import { Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FormFieldComponent } from './form-field.component';
import { FormInputDirective } from './form-input.directive';
import { NoNegativeNumberDirective } from './no-negative-number.directive';

/** Control de tamaño de fuente + botón "Previsualizar Documento". */
@Component({
  selector: 'app-document-preview-control',
  standalone: true,
  imports: [FormsModule, MatIconModule, FormFieldComponent, FormInputDirective, NoNegativeNumberDirective],
  template: `
    <div class="mt-stack-md flex flex-col items-end gap-1">
      <div class="flex justify-end items-center">
        <div class="mr-4 w-48">
          <app-form-field label="Tamaño de fuente documento" for="font_size_preview">
            <input
              appFormInput
              id="font_size_preview"
              type="number"
              min="1"
              max="24"
              class="py-1.5"
              [ngModel]="fontSize()"
              (ngModelChange)="onFontSizeChange($event)">
          </app-form-field>
        </div>
        <button
          type="button"
          [disabled]="loading() || !tamanoValido()"
          (click)="preview.emit(fontSize())"
          class="inline-flex items-center gap-2 px-3 py-1.5 border border-primary text-primary rounded hover:bg-primary-fixed transition-colors font-medium text-[10px] disabled:text-primary/40 disabled:border-primary/40 disabled:hover:bg-transparent disabled:cursor-not-allowed">
          @if (loading()) {
            <mat-icon class="animate-spin text-[16px] flex items-center justify-center">sync</mat-icon> Generando…
          } @else {
            <mat-icon class="text-[16px] flex items-center justify-center">visibility</mat-icon> Previsualizar Documento
          }
        </button>
      </div>
      @if (!tamanoValido()) {
        <p class="text-error text-xs text-right">El tamaño de letra debe ser 1 o más.</p>
      }
      @if (error()) {
        <p class="text-error text-xs text-right">{{ error() }}</p>
      }
    </div>
  `
})
export class DocumentPreviewControlComponent {
  readonly fontSize = model(10);
  /** Con un tamaño inválido (0 o campo vacío) no se previsualiza: el servicio lo rechazaría. */
  protected readonly tamanoValido = computed(() => this.fontSize() >= 1);
  /** Previsualización en curso: deshabilita el botón mientras se genera el PDF. */
  readonly loading = input(false);
  /** Motivo del último fallo de previsualización; vacío si no hubo. */
  readonly error = input('');
  readonly preview = output<number>();

  /**
   * El mínimo es 1, pero **no se corrige el valor mientras se escribe**: se avisa y
   * se bloquea la previsualización.
   *
   * Forzarlo a 1 en cada tecla era peor que el error que evitaba — al teclear `0`
   * aparecía un `1` delante y había que borrarlo a mano. Un cero tampoco llega al
   * servicio: el mapper omite el campo cuando no es un número válido y el acta sale
   * con el tamaño por defecto.
   */
  onFontSizeChange(value: number): void {
    this.fontSize.set(Number(value) || 0);
  }
}
