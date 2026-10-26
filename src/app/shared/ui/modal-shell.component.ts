import { Component, ElementRef, HostListener, afterNextRender, computed, input, output, viewChild } from '@angular/core';

/**
 * Contenedor de modal: overlay con backdrop, centrado, cierre por clic en el
 * fondo o tecla Escape. El contenido del modal se proyecta.
 *
 * El diálogo **nunca es más alto que la pantalla**: se topa en 90vh y su propio
 * contenido hace scroll. Sin eso, en pantallas de menos de 1080p el contenido
 * largo (p. ej. el resumen de la cesión) se salía del viewport y no había forma
 * de alcanzarlo, porque la rueda movía la página de atrás.
 */
@Component({
  selector: 'app-modal-shell',
  standalone: true,
  template: `
    <!-- Clic en el fondo = afford. de puntero; el teclado cierra con Escape (HostListener). -->
    <div
      role="presentation"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm"
      (click)="onBackdropClick($event)">
      <!--
        overflow-y-auto con max-h-[90vh]: el diálogo es su propio contenedor de
        scroll, así que la rueda sobre él lo desplaza en vez de mover el fondo.
        overscroll-contain evita que al llegar al final el scroll se encadene a
        la página. El tabindex -1 y el foco (ver el constructor) hacen que las
        flechas y Page Up/Down también actúen sobre el diálogo.
      -->
      <div
        #dialog
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="bg-surface-container-lowest w-full max-h-[90vh] overflow-y-auto overscroll-contain rounded-xl shadow-2xl border border-outline-variant/30 focus:outline-none"
        [class]="maxWidthClass()">
        <ng-content />
      </div>
    </div>
  `
})
export class ModalShellComponent {
  readonly maxWidth = input<'md' | 'lg'>('lg');
  readonly dismiss = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  protected readonly maxWidthClass = computed(() =>
    this.maxWidth() === 'md' ? 'max-w-md' : 'max-w-lg'
  );

  constructor() {
    // El foco entra al diálogo al abrirlo: sin esto el teclado sigue operando
    // sobre la página de atrás (las flechas desplazaban el fondo). Es además lo
    // que se espera de un modal accesible.
    afterNextRender(() => this.dialog().nativeElement.focus({ preventScroll: true }));
  }

  /** Solo el clic directo sobre el fondo cierra; los clics dentro del diálogo no cuentan. */
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.dismiss.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss.emit();
  }
}
