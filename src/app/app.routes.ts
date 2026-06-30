import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./domains/contratos/presentation/pages/dashboard-contratos/dashboard-contratos.component')
      .then(m => m.DashboardContratosComponent)
  },
  {
    path: 'contratos/:contractId/novedades/adicion-prorroga',
    loadComponent: () => import('./domains/contratos/presentation/pages/crear-adicion-prorroga/crear-adicion-prorroga.component')
      .then(m => m.CrearAdicionProrrogaComponent)
  },
  {
    path: 'contratos/:contractId/novedades/suspension',
    loadComponent: () => import('./domains/contratos/presentation/pages/crear-suspension/crear-suspension.component')
      .then(m => m.CrearSuspensionComponent)
  },
  {
    path: 'contratos/:contractId/novedades/cesion',
    loadComponent: () => import('./domains/contratos/presentation/pages/crear-cesion/crear-cesion.component')
      .then(m => m.CrearCesionComponent)
  },
  {
    path: 'contratos/:contractId/novedades/terminacion',
    loadComponent: () => import('./domains/contratos/presentation/pages/crear-terminacion/crear-terminacion.component')
      .then(m => m.CrearTerminacionComponent)
  },
  {
    path: 'contratos/:contractId/novedades/reinicio',
    loadComponent: () => import('./domains/contratos/presentation/pages/crear-reinicio/crear-reinicio.component')
      .then(m => m.CrearReinicioComponent)
  }
];
