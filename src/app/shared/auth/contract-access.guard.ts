import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { UserSessionService } from './user-session.service';
import { IContractRepository } from '../../domains/contratos/domain/repositories/contract.repository';
import { canManageContract } from '../../domains/contratos/domain/contract.rules';

/**
 * Guarda de las rutas de creación de novedades: un usuario cuyo único rol es
 * SUPERVISOR solo puede tramitar novedades de contratos que supervisa
 * (coincidencia de documento, requerimientos §4). Los demás roles pasan.
 */
export const contractAccessGuard: CanActivateFn = route => {
  const session = inject(UserSessionService).session();
  const router = inject(Router);
  const repository = inject(IContractRepository);

  const contractId = route.paramMap.get('contractId') ?? '';
  return repository.getContractById(contractId).pipe(
    map(contract =>
      contract && canManageContract(session.roles, session.documento, contract)
        ? true
        : router.createUrlTree(['/'])
    )
  );
};
