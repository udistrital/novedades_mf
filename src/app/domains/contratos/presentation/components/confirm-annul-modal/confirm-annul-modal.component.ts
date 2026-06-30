import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ModalShellComponent } from '../../../../../shared/ui/modal-shell.component';

/** Diálogo destructivo de confirmación para anular una novedad. */
@Component({
  selector: 'app-confirm-annul-modal',
  standalone: true,
  imports: [MatIconModule, ModalShellComponent],
  styles: [`.icon-filled { font-variation-settings: 'FILL' 1; }`],
  templateUrl: './confirm-annul-modal.component.html'
})
export class ConfirmAnnulModalComponent {
  readonly contractNumber = input.required<string>();
  readonly vigencia = input<string>('');
  readonly tipo = input.required<string>();
  readonly fecha = input.required<string>();
  readonly estado = input.required<string>();
  readonly submitting = input(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
