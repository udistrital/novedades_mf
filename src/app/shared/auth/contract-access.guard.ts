import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';

import { UserSessionService } from './user-session.service';
import { IContractRepository } from '../../domains/contratos/domain/repositories/contract.repository';
import { ContractAction } from '../../domains/contratos/domain/models/contract-status.enum';
import { availableActions, canManageContract } from '../../domains/contratos/domain/contract.rules';

/**
 * Guarda de las rutas de creación de novedades. Comprueba dos cosas antes de dejar
 * entrar, y devuelve al panel si falla cualquiera:
 *
 * 1. **Rol**: un usuario cuyo único rol es SUPERVISOR solo puede tramitar novedades
 *    de contratos que supervisa (coincidencia de documento, requerimientos §4).
 * 2. **Estado del contrato**: la novedad que la URL pretende crear tiene que estar
 *    entre las que ese contrato admite hoy (`availableActions`).
 *
 * La segunda es una **mejora sobre el aplicativo legado**, no una migración: allí las
 * rutas (`#/seguimientoycontrol/legal/acta_suspension/:id/:vigencia`) se declaran sin
 * `resolve` ni verificación alguna, así que pegando la URL se abre el formulario de
 * cualquier novedad sobre cualquier contrato —finalizado, anulado, sin acta de inicio
 * o con una novedad en trámite— y el trámite solo se cae al final, si es que se cae.
 * Es prevención de accidentes y de datos inconsistentes; el control de verdad tiene
 * que estar en el backend, que hoy solo valida el cambio de estado en tres de los
 * cinco tipos.
 *
 * Se apoya en la **misma** `availableActions` que arma el menú del panel: si el menú
 * no ofrece la acción, la URL tampoco entra, y las dos no pueden divergir.
 */
export const contractAccessGuard: CanActivateFn = (route, state) => {
  const session = inject(UserSessionService).session();
  const router = inject(Router);
  const repository = inject(IContractRepository);

  const contractId = route.paramMap.get('contractId') ?? '';
  const accion = accionDeRuta(state.url);

  return repository.getContractById(contractId).pipe(
    map(contract => {
      const permitido =
        !!contract &&
        !!accion &&
        canManageContract(session.roles, session.documento, contract) &&
        availableActions(contract).includes(accion);
      return permitido || router.createUrlTree(['/']);
    })
  );
};

/**
 * Acción que la URL pretende ejecutar, o `undefined` si el último segmento no
 * corresponde a ninguna.
 *
 * Los valores de `ContractAction` **son** los segmentos de ruta
 * (`…/novedades/suspension` → `ContractAction.SUSPENSION`), así que no hace falta una
 * tabla de traducción que pueda quedar desalineada con `app.routes.ts`.
 */
export function accionDeRuta(url: string): ContractAction | undefined {
  const segmento = url.split('?')[0].split('/').filter(Boolean).pop();
  return ACCIONES_POR_RUTA.find(accion => accion === segmento);
}

const ACCIONES_POR_RUTA: readonly ContractAction[] = Object.values(ContractAction);
