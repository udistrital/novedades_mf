import { Component, ElementRef, HostListener, Input, inject, output, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Contract, NoveltySummary } from '../../../domain/models/contract.entity';
import { NoveltyType } from '../../../domain/models/novelty-type.enum';

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
  imports: [CommonModule, CurrencyPipe, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './contract-accordion.component.html'
})
export class ContractAccordionComponent {
  @Input({ required: true }) contract!: Contract;

  /** Solicitud de anulación de una novedad. */
  readonly annul = output<NoveltySummary>();

  private readonly elementRef = inject(ElementRef);

  readonly isMenuOpen = signal(false);

  readonly noveltyMenuOptions: readonly NoveltyMenuOption[] = [
    { type: NoveltyType.ADDITION_EXTENSION, label: 'Adición y/o Prórroga', icon: 'add_circle', path: 'adicion-prorroga' },
    { type: NoveltyType.SUSPENSION, label: 'Suspensión', icon: 'pause_circle', path: 'suspension' },
    { type: NoveltyType.ASSIGNMENT, label: 'Cesión', icon: 'swap_horiz', path: 'cesion' },
    { type: NoveltyType.EARLY_TERMINATION, label: 'Terminación Anticipada', icon: 'cancel', path: 'terminacion' }
  ];

  toggleMenu(): void {
    this.isMenuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isMenuOpen.set(false);
  }
}
