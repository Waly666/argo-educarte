# ARGO

**Software para CEAs** (Centros de Enseñanza Automovilística) — gestión integral de alumnos, matrículas, caja, certificados, programación académica, jornadas, vehículos y recursos humanos.

**Estado:** producto en uso operativo con desarrollo activo. Módulo de **facturación electrónica** aún pendiente.

## Documentación

| Archivo | Para qué sirve |
|---------|----------------|
| **[ARGO-FACTO.md](./ARGO-FACTO.md)** | Resumen ejecutivo: módulos, madurez, stack, pendientes |
| **[ARGO-ESPECIFICACIONES.md](./ARGO-ESPECIFICACIONES.md)** | Requisitos funcionales, reglas de negocio y alarmas |
| **[ARGO-CONTEXTO.md](./ARGO-CONTEXTO.md)** | Arquitectura, API, rutas, modelos y convenciones (**desarrolladores / IA**) |
| `argo-frontend/README.md` | Notas del proyecto Angular |

## Módulos principales

| Módulo | Descripción breve |
|--------|-------------------|
| **Alumnos** | Ficha, documentos, matrículas, pagos, certificados |
| **Programas y servicios** | Catálogo académico, tarifas, formato de certificado |
| **Caja** | Turno, ingresos, egresos, arqueo, cierres, descuadres, cierre general |
| **Certificados** | Emisión por tipo (curso, licencia, MP, jornadas…), plantillas, alertas |
| **Programación CEA** | Teoría/taller/práctica, calendario, rastreo alumno |
| **Jornadas Cap.** | Contratos empresa, carpas, asistencia, certificado automático |
| **Vehículos** | Flota, documentos, inspección preoperacional |
| **Instructores** | Hub y portal del instructor |
| **Dashboard** | KPIs y resumen financiero |
| **RRHH / nómina** | Empleados, contratos, períodos, novedades |
| **Configuración** | Usuarios, roles, permisos, alarmas, catálogos, auditoría |
| **Sedes** | Multi-sede con filtro por usuario |
| **Facturación** | ⏳ Pendiente (placeholder) |
| **Aula virtual** | Portal alumnos (catálogo, registro, player cursos HTML) — `argo-aula-virtual` :4202 |

## Estructura del repositorio

```
ARGO/
├── ARGO-FACTO.md
├── ARGO-ESPECIFICACIONES.md
├── ARGO-CONTEXTO.md
├── argo-backend/         # API Node.js + Express + MongoDB
├── argo-frontend/        # SPA Angular 19 (staff)
└── argo-aula-virtual/    # Portal alumnos — Angular 19, puerto 4202
```

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 20+, Express 4, Mongoose 8 |
| Base de datos | MongoDB |
| Autenticación | JWT + RBAC (`RolApp`) |
| Frontend | Angular 19 (standalone), pnpm |
| Moneda / locale | COP, `es-CO` |

## Requisitos

- Node.js 20+
- [pnpm](https://pnpm.io)
- MongoDB en ejecución

## Desarrollo local

```bash
# Backend (terminal 1)
cd argo-backend
pnpm install
# Crear argo-backend/.env (MONGO_URI, JWT_SECRET, PORT, …)
pnpm run dev

# Frontend staff (terminal 2)
cd argo-frontend
pnpm install
pnpm start

# Portal aula virtual (opcional, terminal 3)
cd argo-aula-virtual
pnpm install
pnpm start
```

- API: `http://localhost:3000` — health: `GET /api/health`
- App staff: `http://localhost:4200`
- Portal alumnos: `http://localhost:4202`

Al iniciar, el backend muestra enlaces **Local** y **Red (LAN)** con la IP del servidor.

### Abrir desde otro equipo en la misma red

1. Inicie backend y frontend en la PC servidor.
2. Copie la URL LAN del backend (ej. `http://192.168.x.x:3000`).
3. En el otro equipo abra `http://192.168.x.x:4200`.

El frontend resuelve `apiUrl` con el hostname del navegador (`argo-frontend/src/environments/environment.ts`).

**Windows:** permita Node.js en firewall (puertos **3000** y **4200**).

## Variables de entorno (backend)

Cree `argo-backend/.env` con al menos:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto API (default 3000) |
| `MONGO_URI` | Cadena de conexión MongoDB |
| `JWT_SECRET` | Secreto para tokens |
| `JWT_EXPIRES` | Ej. `12h` |
| `UPLOAD_DIR` | Carpeta de archivos subidos |
| `PUBLIC_URL` | URL pública del API |
| `CORS_ORIGIN` | Origen permitido del frontend |

## Scripts útiles (backend)

```bash
cd argo-backend
pnpm run dev                    # desarrollo con nodemon
pnpm run seed                   # datos base
pnpm run seed:users
pnpm run seed:catalogos
pnpm run seed:config
pnpm run migrate:numdoc
pnpm run migrate:tipo-alumno
pnpm run migrate:tipo-certificado
pnpm run cea:depurar-clases     # listar clases CEA depurables
pnpm run jornadas:migrar-sede:dry
```

## Roles por defecto

Al arrancar el API se inicializan roles (`admin`, `cajero`, `instructor`, `recepcion`, `usuario`). Permisos y **alarmas** se administran en **Configuración → Roles, permisos y alarmas**. Detalle en [ARGO-CONTEXTO.md](./ARGO-CONTEXTO.md#5-autenticación-y-permisos-rbac).

## Build producción (frontend)

```bash
cd argo-frontend
pnpm run build
```

Salida en `argo-frontend/dist/argo-frontend`.

## Licencia / uso

Proyecto privado de gestión operativa para CEAs. Consulte [ARGO-ESPECIFICACIONES.md](./ARGO-ESPECIFICACIONES.md) y [ARGO-CONTEXTO.md](./ARGO-CONTEXTO.md) antes de cambios arquitectónicos o de permisos.
