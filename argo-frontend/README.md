# ARGO — Frontend

SPA **Angular 19** del sistema ARGO (CEAs). Documentación del producto:

| Documento | Contenido |
|-----------|-----------|
| [../README.md](../README.md) | Instalación y visión general |
| [../ARGO-FACTO.md](../ARGO-FACTO.md) | Fact sheet del producto |
| [../ARGO-ESPECIFICACIONES.md](../ARGO-ESPECIFICACIONES.md) | Especificaciones funcionales |
| [../ARGO-CONTEXTO.md](../ARGO-CONTEXTO.md) | Arquitectura, rutas, permisos, convenciones |

Generado con [Angular CLI](https://github.com/angular/angular-cli) 19.2.x.

## Inicio rápido

```bash
pnpm install
pnpm start          # LAN :4200 — API esperada en :3000 del mismo host
pnpm start:local    # solo localhost (ng serve)
```

Requiere el backend en ejecución (`cd ../argo-backend && pnpm run dev`).

## Estructura relevante

```
src/app/
├── app.routes.ts       # Rutas + permisoGuard
├── core/               # services, guards, utils, constants
├── features/           # Pantallas por módulo
├── layout/shell/       # Menú, topbar, banners de alarmas
└── shared/             # Componentes reutilizables
```

## Build

```bash
pnpm run build
# Salida: dist/argo-frontend
```

## Convenciones

- Componentes **standalone**; lazy loading en rutas.
- Permisos: `permisoGuard` + claves alineadas con `permisosCatalogo.js` del backend.
- Estilos globales: `src/styles.scss` (tema oscuro, `.cap-*`, tablas `.argo`).
- API base: `environment.ts` → `http://<hostname>:3000/api`.

## Tests

```bash
pnpm test    # Karma (si está configurado)
```

Para detalle de módulos UI y reglas de negocio, ver [ARGO-ESPECIFICACIONES.md](../ARGO-ESPECIFICACIONES.md).
