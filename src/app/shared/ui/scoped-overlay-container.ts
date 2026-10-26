import { Injectable } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';

/** Host del MFE; el mismo selector que usa el ámbito de los estilos globales. */
const HOST = 'novedades-mf';

/**
 * Mete el contenedor de overlays del CDK **dentro** de `<novedades-mf>`, en vez de
 * colgarlo de `<body>` como hace el CDK por defecto.
 *
 * Sin esto el MFE tendría su DOM repartido en dos sitios del documento compartido:
 * el host y `body > .cdk-overlay-container`. Y como todo el CSS del MFE está acotado
 * a `novedades-mf` —para no pisar al shell—, lo que se pintara en el overlay se
 * quedaría sin estilos: el panel del autocomplete de contratista y las utilidades
 * Tailwind de sus opciones. La alternativa era acotar el CSS también a
 * `.cdk-overlay-container`, pero ese contenedor **es del documento, no del MFE**:
 * volveríamos a pisarle los overlays al shell, que es justo el problema que se
 * está resolviendo.
 *
 * Con el contenedor aquí dentro, el MFE es un único subárbol y la regla se vuelve
 * exacta: nada de lo que este MFE inyecta puede alcanzar a un elemento de fuera.
 *
 * Los paneles siguen siendo `position: fixed` y se posicionan respecto al viewport:
 * el `isolation: isolate` del host aísla el contexto de apilamiento, pero no crea
 * bloque contenedor para `fixed`, así que la aritmética de posición del CDK no
 * cambia. Sí quedan por debajo del header del shell — coherente con esa decisión
 * de aislamiento, no un efecto secundario de este archivo.
 */
@Injectable()
export class ScopedOverlayContainer extends OverlayContainer {
  protected override _createContainer(): void {
    super._createContainer();
    // En standalone el host existe desde el index.html; en el shell lo crea
    // single-spa al montar. Si no está, se deja donde el CDK lo puso.
    this._document.querySelector(HOST)?.appendChild(this._containerElement);
  }
}
