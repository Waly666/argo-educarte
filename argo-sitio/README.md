# ARGO — Sitio promocional

Landing pública de **ARGO** (Angular 19). Diseño profesional azul con secciones claras.

## Desarrollo

```bash
cd argo-sitio
pnpm install
pnpm start
```

Abre **http://localhost:4201** (la app operativa sigue en `:4200`).

## Tus videos e imágenes

| Carpeta | Uso |
|---------|-----|
| `public/videos/` | `.mp4` — `presentacion.mp4`, `modulos.mp4`, `demo.mp4` |
| `public/imagenes/` | Posters — `hero-poster.jpg`, `video-*.jpg` |

## Estructura

```
argo-sitio/
├── public/          videos, imágenes, logo
├── src/app/
│   ├── pages/home/  página principal
│   └── pages/home/  página principal
└── contenido/       borradores de textos (opcional)
```

## Enlace a la app

En `home.component.ts` ajusta `APP_LOGIN` para producción.
