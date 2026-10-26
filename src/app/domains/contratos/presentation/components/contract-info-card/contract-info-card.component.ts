import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { ModalShellComponent } from '../../../../../shared/ui/modal-shell.component';
import { SOPORTE_IRIS_URL } from '../../../../../shared/soporte';
import { Contract } from '../../../domain/models/contract.entity';
import { currentContractValue } from '../../../domain/contract.rules';
import { formatDocument } from '../../../../../shared/util/format.util';

/**
 * Tarjeta de contexto "Información del Contrato" de las páginas de novedad:
 * muestra los datos del contrato sobre el que se está tramitando.
 */
@Component({
  selector: 'app-contract-info-card',
  standalone: true,
  imports: [CurrencyPipe, MatIconModule, CardComponent, ModalShellComponent],
  templateUrl: './contract-info-card.component.html'
})
export class ContractInfoCardComponent {
  readonly contract = input.required<Contract>();

  /**
   * El contrato no trae ordenador del gasto. Es el único dato de la tarjeta que
   * bloquea el trámite: `bloqueContrato` del acta lo envía obligatorio y el servicio
   * responde 422 si va vacío, con un motivo que no dice qué campo falta.
   */
  readonly sinOrdenador = computed(() => !this.contract().spendingManager?.trim());

  /** Aviso de que falta el ordenador; se cierra y no vuelve durante la visita. */
  readonly avisoAbierto = signal(true);

  protected readonly soporteUrl = SOPORTE_IRIS_URL;

  /** Valor vigente: base + adiciones históricas (se muestra solo si difiere del inicial). */
  readonly valorVigente = computed(() => currentContractValue(this.contract()));

  /** NIT/CC con puntos de separación visuales. */
  get contractorDocument(): string {
    return formatDocument(this.contract().contractorId);
  }
}
