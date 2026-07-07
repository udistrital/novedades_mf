import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';

import { authInterceptor } from './shared/http/auth.interceptor';
import { IContractRepository } from './domains/contratos/domain/repositories/contract.repository';
import { HttpContractService } from './domains/contratos/infrastructure/http-contract.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Para volver a los datos quemados: useClass: MockContractService (infrastructure/mock-contract.service).
    { provide: IContractRepository, useClass: HttpContractService }
  ]
};
