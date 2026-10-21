import { Directive, HostListener } from '@angular/core';

/**
 * Bloquea el signo "-" en inputs numéricos no negativos (money, días, posiciones, CDP):
 * no se puede escribir, pegar ni soltar un valor negativo. Se aplica automáticamente a
 * todo `input[type=number]` que ya declare `min` (ninguno de esos campos admite negativos).
 */
@Directive({
  // Sin prefijo a propósito: la directiva se auto-aplica a todo input numérico con `min`,
  // en lugar de exigir un atributo `appXxx` en cada campo (ese es su diseño).
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'input[type=number][min]',
  standalone: true
})
export class NoNegativeNumberDirective {
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === '-') event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (event.clipboardData?.getData('text').includes('-')) event.preventDefault();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (event.dataTransfer?.getData('text').includes('-')) event.preventDefault();
  }
}
