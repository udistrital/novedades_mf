import { Component, HostListener, computed, input, output } from '@angular/core';

/**
 * Contenedor de modal: overlay con backdrop, centrado, cierre por clic en el
 * fondo o tecla Escape. El contenido del modal se proyecta.
 */
@Component({
  selector: 'app-modal-shell',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm"
      (click)="dismiss.emit()">
      <div
        class="bg-surface-container-lowest w-full rounded-xl shadow-2xl border border-outline-variant/30 overflow-hidden"
        [class]="maxWidthClass()"
        (click)="$event.stopPropagation()">
        <ng-content />
      </div>
    </div>
  `
})
export class ModalShellComponent {
  readonly maxWidth = input<'md' | 'lg'>('lg');
  readonly dismiss = output<void>();

  protected readonly maxWidthClass = computed(() =>
    this.maxWidth() === 'md' ? 'max-w-md' : 'max-w-lg'
  );

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss.emit();
  }
}
