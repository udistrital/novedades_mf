import { Component, input } from '@angular/core';

/**
 * Label flotante de `app-form-field` y `app-money-field`. Se escribe en la plantilla
 * de la página, junto a su control (`<label appFormLabel for="id">` + `<input id="id">`),
 * y el campo lo proyecta: así el `for` y el `id` quedan en el mismo archivo, que es
 * donde el análisis estático (SonarQube) comprueba que cada control tenga su label.
 *
 * En un campo de solo lectura (un valor calculado, sin control) va sobre un `<span>`:
 * un `<label>` sin control asociado no etiqueta nada.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- va sobre el <label> nativo, como los botones de Material
  selector: 'label[appFormLabel], span[appFormLabel]',
  standalone: true,
  host: {
    class: 'absolute -top-2 left-2 inline-block bg-surface-container-lowest px-1 font-label-sm text-label-sm text-on-surface-variant z-10'
  },
  template: `<ng-content />@if (required()) {<span class="text-error"> *</span>}`
})
export class FormLabelComponent {
  readonly required = input(false);
}
