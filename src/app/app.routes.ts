import { Routes } from '@angular/router';
import { contractAccessGuard } from './shared/auth/contract-access.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./domains/contratos/presentation/pages/dashboard-contratos/dashboard-contratos.component')
      .then(m => m.DashboardContratosComponent)
  },
  {
    // Las vistas de creación comparten el guard de rol: un usuario cuyo único rol es
    // SUPERVISOR solo entra a contratos que supervisa (coincidencia de documento).
    path: 'contratos/:contractId/novedades',
    canActivate: [contractAccessGuard],
    children: [
      {
        path: 'adicion-prorroga',
        loadComponent: () => import('./domains/contratos/presentation/pages/crear-adicion-prorroga/crear-adicion-prorroga.component')
          .then(m => m.CrearAdicionProrrogaComponent)
      },
      {
        path: 'suspension',
        loadComponent: () => import('./domains/contratos/presentation/pages/crear-suspension/crear-suspension.component')
          .then(m => m.CrearSuspensionComponent)
      },
      {
        path: 'cesion',
        loadComponent: () => import('./domains/contratos/presentation/pages/crear-cesion/crear-cesion.component')
          .then(m => m.CrearCesionComponent)
      },
      {
        path: 'terminacion',
        loadComponent: () => import('./domains/contratos/presentation/pages/crear-terminacion/crear-terminacion.component')
          .then(m => m.CrearTerminacionComponent)
      },
      {
        path: 'reinicio',
        loadComponent: () => import('./domains/contratos/presentation/pages/crear-reinicio/crear-reinicio.component')
          .then(m => m.CrearReinicioComponent)
      },
      {
        path: 'poliza',
        loadComponent: () => import('./domains/contratos/presentation/pages/crear-poliza/crear-poliza.component')
          .then(m => m.CrearPolizaComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
