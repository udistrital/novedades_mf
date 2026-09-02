import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { OverlayContainer } from '@angular/cdk/overlay';

import { routes } from './app.routes';

import { authInterceptor } from './shared/http/auth.interceptor';
import { ScopedOverlayContainer } from './shared/ui/scoped-overlay-container';
import { IContractRepository } from './domains/contratos/domain/repositories/contract.repository';
import { HttpContractService } from './domains/contratos/infrastructure/http-contract.service';
import { IActaGenerator } from './domains/contratos/domain/repositories/acta-generator.repository';
import { HttpActaMidService } from './domains/contratos/infrastructure/http-acta-mid.service';

/**
 * Providers compartidos por ambos arranques (standalone y single-spa).
 *
 * Aquí viven los bindings puerto → implementación activa. El de `IActaGenerator`
 * es el punto único a cambiar cuando se reemplace el servicio temporal de actas.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: IContractRepository, useClass: HttpContractService },
    { provide: IActaGenerator, useClass: HttpActaMidService },
    // Overlays dentro del host: mantiene todo el DOM del MFE bajo el único ámbito
    // al que están acotados sus estilos (ver `ScopedOverlayContainer`).
    { provide: OverlayContainer, useClass: ScopedOverlayContainer }
  ]
};
