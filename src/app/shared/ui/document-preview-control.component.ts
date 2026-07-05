import { Component, model, output } from '@angular/core';
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
    <div class="mt-stack-md flex justify-end items-center">
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
        (click)="preview.emit(fontSize())"
        class="inline-flex items-center gap-2 px-3 py-1.5 border border-primary text-primary rounded hover:bg-primary-fixedtransition-colors font-medium text-[10px]">
        <mat-icon class="text-[16px] flex items-center justify-center">visibility</mat-icon> Previsualizar Documento
      </button>
    </div>
  `
})
export class DocumentPreviewControlComponent {
  readonly fontSize = model(10);
  readonly preview = output<number>();

  /** Siempre positivo y ≥ 1, sin importar cómo llegue el valor (tecleado, pegado, spinner). */
  onFontSizeChange(value: number): void {
    this.fontSize.set(Math.max(1, Number(value) || 1));
  }
}
