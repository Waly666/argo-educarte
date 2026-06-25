import { Routes } from '@angular/router';

import { portalPageGuard } from './core/portal-page.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'tienda',
        canActivate: [portalPageGuard],
        loadComponent: () => import('./pages/cursos/cursos.component').then((m) => m.CursosComponent),
        data: { modo: 'tienda' },
      },
      {
        path: 'cursos',
        canActivate: [portalPageGuard],
        loadComponent: () => import('./pages/cursos/cursos.component').then((m) => m.CursosComponent),
        data: { modo: 'cursos' },
      },
      {
        path: 'cursos/:id',
        loadComponent: () =>
          import('./pages/curso-detalle/curso-detalle.component').then((m) => m.CursoDetalleComponent),
      },
      {
        path: 'aula',
        loadComponent: () => import('./pages/aula/aula.component').then((m) => m.AulaComponent),
      },
      {
        path: 'acerca',
        canActivate: [portalPageGuard],
        loadComponent: () => import('./pages/acerca/acerca.component').then((m) => m.AcercaComponent),
      },
      {
        path: 'fundacion',
        canActivate: [portalPageGuard],
        loadComponent: () =>
          import('./pages/fundacion/fundacion.component').then((m) => m.FundacionComponent),
      },
      {
        path: 'consulta-certificados',
        canActivate: [portalPageGuard],
        loadComponent: () =>
          import('./pages/consulta-certificados/consulta-certificados.component').then(
            (m) => m.ConsultaCertificadosComponent,
          ),
      },
      {
        path: 'blog',
        canActivate: [portalPageGuard],
        loadComponent: () => import('./pages/blog/blog.component').then((m) => m.BlogComponent),
      },
      {
        path: 'blog/:slug',
        canActivate: [portalPageGuard],
        loadComponent: () =>
          import('./pages/blog-detalle/blog-detalle.component').then((m) => m.BlogDetalleComponent),
      },
      {
        path: 'login',
        loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'registro',
        loadComponent: () =>
          import('./pages/registro/registro.component').then((m) => m.RegistroComponent),
      },
      {
        path: 'pqr',
        canActivate: [portalPageGuard],
        loadComponent: () => import('./pages/pqr/pqr.component').then((m) => m.PqrComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
