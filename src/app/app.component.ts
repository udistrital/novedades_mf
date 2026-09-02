import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Componente raíz del microfrontend. Su selector es el elemento que single-spa
 * crea al montar el MF en el shell (y el que usa `index.html` en standalone);
 * solo expone el `router-outlet` del dominio.
 */
@Component({
  selector: 'novedades-mf',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html'
})
export class AppComponent {}
