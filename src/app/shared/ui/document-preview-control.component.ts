import { Component, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { FormFieldComponent } from './form-field.component';
import { FormInputDirective } from './form-input.directive';

/** Control de tamaño de fuente + botón "Previsualizar Documento". */
@Component({
  selector: 'app-document-preview-control',
  standalone: true,
  imports: [FormsModule, MatIconModule, FormFieldComponent, FormInputDirective],
  template: `
    <div class="mt-stack-md flex justify-end items-center">
      <div class="mr-4 w-48">
        <app-form-field label="Tamaño de fuente general" for="font_size_preview">
          <input
            appFormInput
            id="font_size_preview"
            type="number"
            min="8"
            max="24"
            class="py-1.5"
            [ngModel]="fontSize()"
            (ngModelChange)="fontSize.set($event)">
        </app-form-field>
      </div>
      <button
        type="button"
        (click)="preview.emit(fontSize())"
        class="inline-flex items-center gap-2 px-3 py-1.5 border border-primary text-primary rounded hover:bg-primary-fixed transition-colors font-medium text-[10px]">
        <mat-icon class="text-[16px] flex items-center justify-center">visibility</mat-icon> Previsualizar Documento
      </button>
    </div>
  `
})
export class DocumentPreviewControlComponent {
  readonly fontSize = model(10);
  readonly preview = output<number>();
}
