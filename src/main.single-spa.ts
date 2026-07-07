import { enableProdMode, NgZone } from '@angular/core';

import { APP_BASE_HREF } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { Router, NavigationStart } from '@angular/router';

import { singleSpaAngular, getSingleSpaExtraProviders } from 'single-spa-angular';


import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

function bootstrapStandaloneApp(){
  return bootstrapApplication(AppComponent, {
    providers: [...appConfig.providers]
  });
}

const lifecycles = singleSpaAngular({
  bootstrapFunction: () => {
    return bootstrapApplication(AppComponent, {
      providers: [
        ...appConfig.providers,
        ...getSingleSpaExtraProviders(),
        // El shell monta este MFE bajo la ruta /novedades. El router de Angular
        // debe tratar ese segmento como su base, si no NG04002 (no match) y rebota.
        { provide: APP_BASE_HREF, useValue: '/novedades' },
      ]
    });
  },
  // Sin `class="mat-typography"`: las reglas de tipografía de Material (h1, h2…)
  // del theme pisan por especificidad a las utilidades Tailwind del MFE al montarse en el shell.
  template: '<novedades-mf />',
  Router,
  NavigationStart,
  NgZone,
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;

// Solo auto-bootstrap en standalone: el elemento host existe en el index.html
// propio del MFE, pero NO en el shell (ahí lo crea single-spa al montar).
if (document.querySelector('novedades-mf')) {
  bootstrapStandaloneApp().catch((err) => console.error(err));
}
