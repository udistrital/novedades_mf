import { Directive } from '@angular/core';

/**
 * Estilo base compartido para inputs, selects y textareas con look "Stitch".
 * Reemplaza las clases del plugin @tailwindcss/forms (form-input/select/textarea)
 * que no está instalado en este proyecto.
 */
@Directive({
  selector: '[appFormInput]',
  standalone: true,
  host: {
    class:
      'block w-full rounded-md border border-outline-variant bg-transparent text-on-surface text-sm px-3 py-2 ' +
      'focus:border-primary focus:border-2 focus:outline-none focus:ring-0 ' +
      'read-only:bg-surface-container-low read-only:text-on-surface-variant ' +
      'disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:cursor-not-allowed'
  }
})
export class FormInputDirective {}
