import { Component, computed, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { CardComponent } from '../../../../../shared/ui/card.component';
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
  imports: [CurrencyPipe, CardComponent],
  templateUrl: './contract-info-card.component.html'
})
export class ContractInfoCardComponent {
  readonly contract = input.required<Contract>();

  /** Valor vigente: base + adiciones históricas (se muestra solo si difiere del inicial). */
  readonly valorVigente = computed(() => currentContractValue(this.contract()));

  /** NIT/CC con puntos de separación visuales. */
  get contractorDocument(): string {
    return formatDocument(this.contract().contractorId);
  }
}
