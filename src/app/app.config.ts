import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';

import { IContractRepository } from './domains/contratos/domain/repositories/contract.repository';
import { MockContractService } from './domains/contratos/infrastructure/mock-contract.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    provideAnimationsAsync(),
    { provide: IContractRepository, useClass: MockContractService }
  ]
};
