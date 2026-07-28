import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';

import { authInterceptor } from './shared/http/auth.interceptor';
import { IContractRepository } from './domains/contratos/domain/repositories/contract.repository';
import { HttpContractService } from './domains/contratos/infrastructure/http-contract.service';

/**
 * Providers compartidos por ambos arranques (standalone y single-spa).
 *
 * Aquí vive el binding del puerto `IContractRepository` → implementación activa.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: IContractRepository, useClass: HttpContractService }
  ]
};
