import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ContractStateService } from '../../../application/contract-state.service';
import { NoveltyService } from '../../../application/novelty.service';
import { ContractAccordionComponent } from '../../components/contract-accordion/contract-accordion.component';
import { ConfirmAnnulModalComponent } from '../../components/confirm-annul-modal/confirm-annul-modal.component';
import { NoveltyResultComponent } from '../../components/novelty-result/novelty-result.component';
import { NoveltyErrorComponent } from '../../components/novelty-error/novelty-error.component';
import { Contract, NoveltySummary } from '../../../domain/models/contract.entity';
import { formatExecutionDate } from '../../../../../shared/util/format.util';

interface AnnulTarget {
  contract: Contract;
  novelty: NoveltySummary;
}

type DashboardView = 'list' | 'annul-success' | 'annul-error';

@Component({
  selector: 'app-dashboard-contratos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    ContractAccordionComponent,
    ConfirmAnnulModalComponent,
    NoveltyResultComponent,
    NoveltyErrorComponent
  ],
  templateUrl: './dashboard-contratos.component.html'
})
export class DashboardContratosComponent implements OnInit {
  readonly state = inject(ContractStateService);
  private readonly fb = inject(FormBuilder);
  private readonly noveltyService = inject(NoveltyService);

  filterForm: FormGroup = this.fb.group({
    number: [''],
    contractor: [''],
    year: ['']
  });

  // Flujo de anulación
  readonly view = signal<DashboardView>('list');
  readonly annulTarget = signal<AnnulTarget | null>(null);
  readonly showAnnulConfirm = signal(false);
  readonly annulling = signal(false);
  readonly executedAt = signal('');

  ngOnInit(): void {
    this.state.loadContracts();
  }

  applyFilters(): void {
    const formValues = this.filterForm.value;
    const filters = Object.fromEntries(
      Object.entries(formValues).filter(([_, v]) => v !== '')
    );
    this.state.loadContracts(filters);
  }

  // --- Anulación ---
  onAnnulRequest(contract: Contract, novelty: NoveltySummary): void {
    this.annulTarget.set({ contract, novelty });
    this.showAnnulConfirm.set(true);
  }

  closeAnnulConfirm(): void {
    this.showAnnulConfirm.set(false);
  }

  confirmAnnul(): void {
    const target = this.annulTarget();
    if (!target) return;

    this.annulling.set(true);
    this.noveltyService.annul(target.contract.id, target.novelty.id).subscribe({
      next: () => {
        this.annulling.set(false);
        this.showAnnulConfirm.set(false);
        this.executedAt.set(formatExecutionDate());
        this.view.set('annul-success');
      },
      error: () => {
        this.annulling.set(false);
        this.showAnnulConfirm.set(false);
        this.view.set('annul-error');
      }
    });
  }

  backToList(): void {
    this.view.set('list');
    this.annulTarget.set(null);
    this.state.loadContracts(this.state.filters());
  }
}
