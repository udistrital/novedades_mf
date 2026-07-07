import { Component, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ModalShellComponent } from '../../../../../shared/ui/modal-shell.component';

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

  // TEST SWITCH — borrar esta línea y el bloque en el HTML para quitarlo.
  readonly forceError = signal(false);

  /** Emite `true` si se debe simular una petición fallida (switch de pruebas). */
  readonly confirm = output<boolean>();
  readonly dismiss = output<void>();
}
