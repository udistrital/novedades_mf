import { Component, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { Contract } from '../../../domain/models/contract.entity';
import { formatDocument } from '../../../../../shared/util/format.util';

@Component({
  selector: 'app-contract-info-card',
  standalone: true,
  imports: [CurrencyPipe, CardComponent],
  templateUrl: './contract-info-card.component.html'
})
export class ContractInfoCardComponent {
  readonly contract = input.required<Contract>();

  /** NIT/CC con puntos de separación visuales. */
  get contractorDocument(): string {
    return formatDocument(this.contract().contractorId);
  }
}
