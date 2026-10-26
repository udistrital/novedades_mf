import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ModalShellComponent } from '../../../../../shared/ui/modal-shell.component';
import { SOPORTE_IRIS_URL } from '../../../../../shared/soporte';

export interface NoveltySummaryItem {
  label: string;
  value: string;
  /** Resalta el valor (color primario, tipografía title). */
  highlight?: boolean;
}

/**
 * Modal de confirmación unificado para generar el acta de cualquier novedad.
 * Solo cambian el texto de la novedad y los campos del resumen (`summary`).
 */
@Component({
  selector: 'app-confirm-novelty-modal',
  standalone: true,
  imports: [MatIconModule, ModalShellComponent],
  templateUrl: './confirm-novelty-modal.component.html'
})
export class ConfirmNoveltyModalComponent {
  readonly noveltyLabel = input.required<string>();
  readonly contractNumber = input.required<string>();
  readonly year = input<string>('');
  readonly summary = input.required<NoveltySummaryItem[]>();
  readonly submitting = input(false);
  /** Cuando es `true`, bloquea la confirmación y muestra `blockedMessage` en vez de la advertencia genérica. */
  readonly blocked = input(false);
  readonly blockedMessage = input('No se puede generar la novedad.');

  readonly soporteUrl = SOPORTE_IRIS_URL;

  readonly confirm = output<void>();
  readonly dismiss = output<void>();
}
