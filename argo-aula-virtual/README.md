# ARGO — Aula virtual (portal alumnos)

Portal Angular 19 para alumnos del CEA: catálogo de cursos virtuales, registro, aula con player HTML/JS y ficha estilo Finstruvial.

## Requisitos

- `argo-backend` en **:3000** (API + `/uploads`)
- Programas con **tarifa virtual** y configuración en ARGO → **Aula virtual**

## Desarrollo

```bash
cd argo-aula-virtual
pnpm install
pnpm start
```

Abre [http://localhost:4202](http://localhost:4202).

## Rutas del portal

| Ruta | Descripción |
|------|-------------|
| `/` | Home con cursos destacados |
| `/tienda`, `/cursos` | Catálogo |
| `/cursos/:id` | Ficha del curso |
| `/aula` | Mis cursos (player iframe) |
| `/login`, `/registro` | Acceso portal |
| `/acerca` | Información del CEA |

## Admin (staff)

En `argo-frontend` (:4200): menú **Aula virtual** (`/app/aula-virtual`).

- Publicar cursos en el portal
- Subir paquete ZIP del curso (HTML/JS)
- Materiales, sesiones Meet, reglas de certificado
- Textos hero y “Acerca de”

## API

Base: `GET/POST` bajo `/api/aula-virtual` (ver `argo-backend/src/routes/aulaVirtual.js`).

## Pendiente

- Pago en línea y matrícula automática (tarifa 4)
- Sincronización de progreso del curso HTML con certificado `al_aprobar`
