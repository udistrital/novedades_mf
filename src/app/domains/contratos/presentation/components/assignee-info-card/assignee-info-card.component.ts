import { Component, input } from '@angular/core';
import { CardComponent } from '../../../../../shared/ui/card.component';
import { Assignee } from '../../../domain/models/assignee.model';

@Component({
  selector: 'app-assignee-info-card',
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card title="Información del Cesionario" icon="person" variant="context">
      <div class="flex flex-col gap-stack-sm font-body-md text-body-md">
        <div>
          <span class="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Cesionario</span>
          <p class="font-medium">{{ assignee()?.name || '—' }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">No. Documento</span>
          <p class="font-medium">{{ assignee()?.documentNumber || '—' }}</p>
        </div>
        <div>
          <span class="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Tipo documento</span>
          <p class="font-medium">{{ assignee()?.documentType || '—' }}</p>
        </div>
      </div>
    </app-card>
  `
})
export class AssigneeInfoCardComponent {
  readonly assignee = input<Assignee | null>(null);
}
