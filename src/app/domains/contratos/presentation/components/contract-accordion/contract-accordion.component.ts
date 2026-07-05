import { Component, ElementRef, HostListener, Input, ViewChild, output, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Contract, NoveltySummary } from '../../../domain/models/contract.entity';
import { NoveltyType } from '../../../domain/models/novelty-type.enum';
import { isContractSuspended } from '../../../domain/contract.rules';
import { formatDocument } from '../../../../../shared/util/format.util';

interface NoveltyMenuOption {
  type: NoveltyType;
  label: string;
  icon: string;
  /** Segmento de ruta de la vista de creación correspondiente. */
  path: string;
}

@Component({
  selector: 'app-contract-accordion',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, MatIconModule],
  templateUrl: './contract-accordion.component.html'
})
export class ContractAccordionComponent {
  @Input({ required: true }) contract!: Contract;

  /** Solicitud de anulación de una novedad. */
  readonly annul = output<NoveltySummary>();

  @ViewChild('menuRef') private menuRef?: ElementRef<HTMLElement>;

  readonly isMenuOpen = signal(false);

  /** Año de vigencia del contrato, derivado de la fecha de inicio (dd/mm/aaaa). */
  get vigencia(): string {
    return this.contract.startDate?.split('/').pop() ?? '';
  }

  /** NIT/CC con puntos de separación visuales. */
  get contractorDocument(): string {
    return formatDocument(this.contract.contractorId);
  }

  /** Opciones disponibles cuando el contrato está en ejecución normal. */
  private static readonly DEFAULT_OPTIONS: readonly NoveltyMenuOption[] = [
    { type: NoveltyType.ADDITION_EXTENSION, label: 'Adición y Prórroga', icon: 'add_circle', path: 'adicion-prorroga' },
    { type: NoveltyType.SUSPENSION, label: 'Suspensión', icon: 'pause_circle', path: 'suspension' },
    { type: NoveltyType.ASSIGNMENT, label: 'Cesión', icon: 'swap_horiz', path: 'cesion' },
    { type: NoveltyType.EARLY_TERMINATION, label: 'Terminación Anticipada', icon: 'cancel', path: 'terminacion' }
  ];

  /** Única opción disponible cuando el contrato está suspendido. */
  private static readonly RESTART_OPTION: NoveltyMenuOption =
    { type: NoveltyType.RESTART, label: 'Reinicio', icon: 'play_circle', path: 'reinicio' };

  /**
   * Si el contrato está suspendido (su última novedad es una suspensión),
   * la única acción posible es el Reinicio; en caso contrario, las novedades normales.
   */
  get noveltyMenuOptions(): readonly NoveltyMenuOption[] {
    return isContractSuspended(this.contract)
      ? [ContractAccordionComponent.RESTART_OPTION]
      : ContractAccordionComponent.DEFAULT_OPTIONS;
  }

  toggleMenu(): void {
    this.isMenuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.menuRef?.nativeElement.contains(event.target as Node)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isMenuOpen.set(false);
  }
}
