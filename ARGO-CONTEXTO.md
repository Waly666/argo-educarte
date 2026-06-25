# ARGO — Contexto del sistema para IA y desarrolladores

Documento de referencia para que cualquier asistente (o persona nueva) entienda **qué es ARGO**, **cómo está armado** y **dónde tocar el código**. Actualizado **mayo 2026**.

Documentos relacionados: [ARGO-FACTO.md](./ARGO-FACTO.md) (resumen producto) · [ARGO-ESPECIFICACIONES.md](./ARGO-ESPECIFICACIONES.md) (requisitos funcionales).

---

## 1. Qué es ARGO

**ARGO** es software de gestión para **CEAs** (Centros de Enseñanza Automovilística) en Colombia. Cubre el ciclo operativo del negocio:

| Área | Función principal |
|------|-------------------|
| **Alumnos** | Ficha del aspirante/conductor, documentos, matrículas, servicios contratados |
| **Académico** | Programas, servicios del catálogo (cursos, técnicos, trámites, CEA, etc.) |
| **Cobros / liquidaciones** | Cargos por servicio, abonos, saldo pendiente (cartera) |
| **Caja** | Apertura por usuario, ingresos, egresos, arqueo, cierre de turno, descuadres |
| **Certificados** | Emisión por tipo de formato, plantillas, QR, alertas vencimiento/vencidos |
| **Programación CEA** | Clases teoría/taller/práctica, calendario, rastreo alumno, clases pendientes |
| **Jornadas de Capacitación** | Contratación con empresas, programación de jornadas/carpas, clases, asistencia, certificado automático por sesiones |
| **Vehículos** | Flota, documentos, inspección preoperacional, alertas |
| **Instructores** | Hub, portal del instructor, clases asignadas |
| **Sedes** | Multi-sede, filtro por usuario, permisos `sedes.*` |
| **RRHH / nómina** | Empleados, contratos laborales, períodos, novedades, liquidación nómina |
| **Configuración** | Usuarios, roles, permisos y alarmas, catálogos, recibos, certificados, auditoría |
| **Facturación** | ⏳ Placeholder — sin integración DIAN aún |

Moneda y formato: **COP**, locale `es-CO`, montos sin decimales en UI (`maximumFractionDigits: 0`).

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | Node.js 20+, Express 4, Mongoose 8, MongoDB |
| **Auth** | JWT (`Bearer`), bcrypt en usuarios |
| **Frontend** | Angular 19 (standalone components, signals en partes nuevas) |
| **Paquetes** | pnpm en backend y frontend |
| **Otros** | multer (uploads), sharp, tesseract.js (OCR), qrcode, xlsx |

### Puertos y red

- API: `http://localhost:3000` (variable `PORT`)
- Frontend dev: `4200` (`pnpm start` usa `scripts/serve-lan.js` para LAN)
- El frontend resuelve `apiUrl` como `http://<hostname-del-navegador>:3000/api` para que otros PCs en la red usen la misma IP.

### Variables de entorno (backend)

Archivo: `argo-backend/.env` (plantilla `.env.example`)

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/argo
JWT_SECRET=...
JWT_EXPIRES=12h
UPLOAD_DIR=uploads
PUBLIC_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:4200
```

---

## 3. Arquitectura general

```mermaid
flowchart TB
  subgraph cliente [Cliente]
    Browser[Navegador Angular 19]
  end
  subgraph api [argo-backend]
    Express[Express /api]
    AuthMW[JWT + requirePermiso]
    Ctrl[Controllers]
    Svc[Services]
    Models[Mongoose Models]
  end
  subgraph data [Datos]
    Mongo[(MongoDB)]
    Uploads[/uploads estáticos]
  end
  Browser -->|HTTP JSON + JWT| Express
  Express --> AuthMW --> Ctrl --> Svc --> Models --> Mongo
  Express --> Uploads
```

### Principios

- **API REST** bajo prefijo `/api`
- **Catálogos flexibles**: muchas colecciones Mongo con esquema Mongoose `strict: false` (`catalogos.js`)
- **Reglas de negocio** en `services/` (caja, nómina, dashboard, roles, liquidación, etc.)
- **Frontend** por features (`features/`) + núcleo (`core/services`, `core/guards`, `core/utils`)
- **RBAC configurable**: permisos en BD (`RolApp`) + catálogo en código (`permisosCatalogo.js`)

---

## 4. Estructura del repositorio

```
ARGO/
├── README.md
├── ARGO-FACTO.md             # Resumen ejecutivo del producto
├── ARGO-ESPECIFICACIONES.md  # Requisitos funcionales
├── ARGO-CONTEXTO.md          ← este archivo
├── argo-backend/
│   ├── src/
│   │   ├── server.js         # arranque, init roles/nómina
│   │   ├── app.js            # Express, CORS, /api, estáticos uploads
│   │   ├── routes/           # routers por dominio
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middleware/       # auth, upload, auditoría HTTP, errores
│   │   ├── constants/        # permisosCatalogo, jornadaCapacitacion, tipoAlumno
│   │   └── utils/
│   │   # Servicios destacados: cajaSesion, dashboardStats, programacionJornadas,
│   │   # programacionCeaAuto, georefMunicipio, jornadaCapacitacion, rolesPermisos,
│   │   # clasificacionCertificado, certificadoJornadaAuto
│   └── scripts/              # seed, migraciones, imports
└── argo-frontend/
    └── src/app/
        ├── app.routes.ts     # rutas + permisoGuard
        ├── core/             # services, guards, utils, constants
        ├── features/         # pantallas por módulo (alumnos, jornadas, caja, programacion-cea, vehiculos, …)
        │   ├── alumnos/      # lista, detalle, tabs, alumnos-rutas.helpers.ts
        │   └── jornadas/     # hub contratación, instructor, mapa
        ├── layout/shell/     # menú lateral, topbar, banner caja
        └── shared/
```

---

## 5. Autenticación y permisos (RBAC)

### Flujo de login

1. `POST /api/auth/login` → JWT + usuario con `permisos[]`, `rolNombre`
2. Frontend guarda token y usuario en `localStorage` (`AuthService`)
3. `PermisoService` lee permisos del usuario en localStorage (evita dependencia circular con `AuthService`)
4. Al cargar shell: `refreshMe()` actualiza permisos desde `GET /api/auth/me`

### Middleware backend

| Función | Uso |
|---------|-----|
| `requireAuth` | JWT válido |
| `loadPermisos` | Carga `req.permisos` desde rol |
| `requirePermiso('clave')` | Una o varias claves del catálogo |
| `requireAdmin` | Rol admin legacy |
| `requireGestionProgramas` | Programas (regla especial) |

Archivos clave:

- `argo-backend/src/middleware/auth.js`
- `argo-backend/src/services/rolesPermisos.js`
- `argo-backend/src/constants/permisosCatalogo.js`
- `argo-backend/src/models/RolApp.js`
- `argo-frontend/src/app/core/guards/permiso.guard.ts`
- `argo-frontend/src/app/core/services/permiso.service.ts`
- `argo-frontend/src/app/features/config/roles-permisos-admin.component.*`

### Roles del sistema (semilla)

| Código | Nombre | Alcance típico |
|--------|--------|----------------|
| `admin` | Administrador | `permisos: ['*']` |
| `cajero` | Cajero | Dashboard, alumnos, pagos, caja turno/cobros |
| `instructor` | Instructor | Solo dashboard + módulo instructores (placeholder) |
| `recepcion` | Recepción | Alumnos y catálogo académico |
| `usuario` | Usuario | Consulta básica |

Los permisos se editan en **Configuración → Roles y permisos** (`/app/configuracion/roles`).

### Catálogo de permisos (claves)

Fuente: `argo-backend/src/constants/permisosCatalogo.js`

| Grupo | Claves |
|-------|--------|
| General | `dashboard` |
| Alumnos | `alumnos.ver`, `alumnos.gestionar`, `alumnos.pagos`, `alumnos.certificados` |
| Académico | `programas.ver`, `programas.agregar`, `programas.gestionar`, `servicios.ver`, `servicios.gestionar`, `instructores`, `instructores.mi_portal`, `instructores.inspeccion` |
| Jornadas Cap. | `jornadas.ver`, `jornadas.gestionar`, `jornadas.operar` |
| Programación CEA | `programacion_cea.ver`, `programacion_cea.gestionar`, `programacion_cea.operar` |
| Caja | `caja.turno`, `caja.cobros`, `caja.admin` |
| Otros | `facturacion`, `vehiculos`, `rrhh` |
| Sedes | `sedes.ver`, `sedes.ver_todas`, `sedes.gestionar`, `config.sedes` |
| Config | `config.usuarios`, `config.roles`, `config.catalogos`, `config.recibos`, `config.georef`, `config.nomina`, `config.certificados`, `config.requisitos`, `config.auditoria`, `config.monitor` |

**Alarmas** (por rol, no son permisos de ruta): catálogo en `alarmasCatalogo.js` — caja, certificados, jornadas, CEA, instructores, vehículos, empleados, alumnos.

El menú lateral (`shell.component.ts`) y las rutas (`app.routes.ts`) filtran ítems con `permiso` / `permisoGuard`.

---

## 6. Modelo de datos principal (MongoDB)

### Entidades con esquema definido

| Modelo | Colección | Notas |
|--------|-----------|--------|
| `DatosAlumno` | **datosAlumnos** | `numDoc` numérico; `tipoAlumno`: `Regular` \| `Jornadas de Capacitación` |
| `Contratacion` | **contratacion** | Contrato empresa para jornadas (no es RRHH `Contrato`) |
| `JornadaCap` | **jornadasCap** | Jornada programada por contrato y fecha |
| `ClaseJornadaCap` | **clasesJornadaCap** | Sesión/clase dentro de una jornada |
| `AsisClasJorCap` | **asisClasJorCap** | Asistencia por documento en una clase |
| `Supervisor` | supervisores | Supervisor de contratación jornadas |
| `Matricula` | matriculas | Vinculada a programa |
| `Liquidacion` | liquidacion | `valor`, `abonado`, `saldo`, `estado` (pendiente/parcial/pagado) |
| `Ingreso` | ingresos | Recibos de caja; `idTipoPago`, `formaPago`, `idLiquidacion` |
| `Egreso` | egresos | `formaPago`, tipos de egreso |
| `Certificado` | certificados | Plantilla, emisión, anulación |
| `CajaSesion` | cajaSesiones | Apertura/cierre por cajero (`idSesion` numérico) |
| `CajaDescuadre` | cajaDescuadres | Faltantes de cierre, nómina |
| `CajaCierreGeneral` | cajaCierreGeneral | Cierre consolidado multi-caja |
| `Usuario` | usuarios | Login, rol, vínculo empleado opcional |
| `RolApp` | rolesApp | Permisos por rol |
| `Empleado`, `Contrato`, `PeriodoNomina`, `NovedadNomina`, `LiquidacionNomina` | RRHH |
| `Auditoria`, `ActividadHttp` | Trazabilidad |
| `Config`, `PlantillaCertificado` | Configuración |

### Catálogos (esquema flexible)

Definidos en `argo-backend/src/models/catalogos.js`, entre otros:

- `catTipoPago`, `tipoIngreso`, `tipoEgreso`
- `servicios`, `programas`
- Demografía: `genero`, `estrato`, `ocupacion`, etc.
- Vehículos: `claseVehiculo`, `marcasVehiculos`, …
- RRHH: cargos, EPS, AFP, ARL vía modelos dedicados también

API genérica de catálogos: `GET/POST/PUT/DELETE /api/catalogos/:nombre`.

---

## 7. API REST — mapa de rutas

Prefijo: **`/api`**

| Prefijo | Dominio |
|---------|---------|
| `/auth` | login, me, cambio contraseña |
| `/alumnos` | CRUD alumnos, búsqueda (`?tipoAlumno=` filtra lista) |
| `/jornadas` | Contratación, jornadas, clases, asistencias, certificados jornada, georef |
| `/programacion-cea` | Config CEA, clases, rastreo, temas, generar pendientes |
| `/vehiculos` | Flota, documentos, inspección, alertas |
| `/sedes` | Catálogo de sedes |
| `/instructor-portal` | Mis clases y alertas del instructor |
| `/matriculas` | Matrículas por alumno |
| `/liquidacion` | Liquidaciones, abonos |
| `/ingresos` | Ingresos, anulación, recibos |
| `/egresos` | Egresos de caja |
| `/certificados` | Emisión, PDF, QR |
| `/caja` | Sesión activa, apertura, cierre, resúmenes, descuadres |
| `/programas`, `/servicios` | Catálogo académico |
| `/catalogos` | Catálogos Mongo |
| `/usuarios`, `/roles` | Usuarios y roles |
| `/config` | Empresa, recibos, nómina, certificados, requisitos |
| `/rrhh` | Empleados, contratos, nómina, novedades |
| `/dashboard` | `GET /estadisticas?desde=&hasta=` |
| `/auditoria`, `/actividad` | Logs |

Health: `GET /api/health`

---

## 8. Frontend — rutas principales

| Ruta | Componente / notas |
|------|-------------------|
| `/login` | Login |
| `/app/dashboard` | Panel ejecutivo, KPIs, gráficos |
| `/app/alumnos` | Lista **todos** los alumnos (tipo Regular y jornadas) |
| `/app/alumnos/nuevo`, `/app/alumnos/:id` | Ficha alumno flujo general (`AlumnoDetalleComponent`) |
| `/app/jornadas/alumnos` | Lista **solo** `tipoAlumno = Jornadas de Capacitación` |
| `/app/jornadas/alumnos/nuevo`, `/app/jornadas/alumnos/:id` | Misma ficha, modo jornada (`modoAlumnos: 'jornadas'` en ruta) |
| `/app/jornadas` | Hub: contratación → jornadas → clases → certificados (`jornadas-hub`) |
| `/app/jornadas/instructor` | Operación en carpa: clases del día, asistencia |
| `/app/programas`, `/app/servicios` | Administración académica |
| `/app/programacion-cea` | Hub CEA: config, pendientes, rastreo, calendario |
| `/app/programacion-cea/clases-grupales` | Teoría y taller (calendario) |
| `/app/programacion-cea/clases-practica` | Práctica en vehículo |
| `/app/programacion-cea/clases-hoy` | Clases CEA del día |
| `/app/certificados` | Listado global certificados emitidos |
| `/app/vehiculos` | Lista y ficha vehículo |
| `/app/instructores` | Hub instructores; `/app/instructores/:idEmpleado` detalle |
| `/app/cobros-pendientes` | Liquidaciones con saldo |
| `/app/caja` | Layout caja → cuadre, ingresos, egresos del turno |
| `/app/cierres`, `/app/cierres/:idSesion` | Historial y detalle de cierre |
| `/app/cierre-general` | Cierre administrativo multi-caja |
| `/app/caja/ingresos-todos`, `egresos-todos`, `descuadres` | Admin caja |
| `/app/rrhh/*` | Hub, empleados, contratos, catálogos RRHH, nómina, novedades |
| `/app/configuracion/*` | Usuarios, sedes, roles/alarmas, catálogos, recibos, certificados, requisitos docs, georef, nómina, auditoría, monitor |
| `/recibo/:ingresoId`, `/recibo-egreso/:egresoId` | Impresión comprobantes |

**Placeholder:** solo `/app/facturacion` (módulo pendiente).

---

## 9. Módulos funcionales (detalle)

### 9.1 Alumnos y matrículas

**Dos flujos de UI** (mismo formulario, rutas distintas):

| Flujo | Lista | Nuevo | Ficha | Volver |
|-------|-------|-------|-------|--------|
| General | `/app/alumnos` | `/app/alumnos/nuevo` | `/app/alumnos/:id` | `/app/alumnos` |
| Jornadas Cap. | `/app/jornadas/alumnos` | `/app/jornadas/alumnos/nuevo` | `/app/jornadas/alumnos/:id` | `/app/jornadas/alumnos` |

Helpers de rutas: `argo-frontend/src/app/features/alumnos/alumnos-rutas.helpers.ts` (`ModoAlumnos`, `rutasAlumnos()`).

**Componentes clave**

| Componente | Rol |
|------------|-----|
| `alumnos-lista.component` | Lista con búsqueda; en modo jornada pasa `tipoAlumno` al API |
| `alumno-detalle.component` | Carga alumno (`porId`), pestañas, `AlumnoStore` |
| `tabs/datos-principales.component` | Formulario datosAlumnos; recibe `[alumno]` y `[modo]` |
| `AlumnoStore` | Signal compartido entre pestañas de la ficha |

**Pestañas de la ficha:** Datos Principales, Servicios (matrícula/liquidación), Pagos, Certificados, Documentos.

**Datos Principales**

- Sincronización store → `form` signal (effects en constructor; no usar `toObservable` en `ngOnInit` — error NG0203).
- Alta jornada: `tipoAlumno` fijado a **Jornadas de Capacitación**; campo deshabilitado en UI.
- Campos legacy BD: `nombres` / `apellidos` se mapean a `nombre1` / `apellido1` en `mapDesdeBd`.
- OCR cédula: `POST /api/alumnos/escanear-cedula`.

**API lista:** `GET /api/alumnos?tipoAlumno=Jornadas de Capacitación` filtra por tipo normalizado.

**Matrícula / cobro**

- Alumnos **Regular**: matrícula y liquidación con valor según programa/servicio.
- Alumnos **Jornadas de Capacitación**: programas tipo jornada **no generan servicio** ni matrícula cobrada (`jornadaCapacitacion.js`, `programaController.js`).

### 9.2 Liquidaciones y pagos

- **Liquidación** = cargo por servicio (`valor`, `abonado`, `saldo`, `estado`).
- **Ingreso** = recibo de caja; puede aplicarse a liquidación(es).
- Forma de pago: prioriza **catálogo `catTipoPago`** (`idTipoPago`); fallback `formaPago` en documento.
- Medios canónicos en UI/dashboard: Efectivo, Transferencia, Tarjeta crédito/débito, Cheque, Nequi/Daviplata (`metodoPagoCanonico.js` / `metodo-pago.util.ts`).

### 9.3 Caja (turno)

Flujo típico del cajero:

1. **Apertura** de sesión personal (`CajaSesion`, estado `abierta`).
2. **Ingresos** / **egresos** asociados a `idSesion`.
3. **Cuadre**: ventas por método de pago, por tipo de ingreso, efectivo esperado vs contado (arqueo).
4. **Cierre**: guarda resumen en `sesion.resumen`, puede exigir autorización admin si hay descuadre.
5. Banner global si el usuario con `caja.turno` no tiene caja abierta (`CajaEstadoService`, `caja-cerrada-banner`).

Servicio central backend: `argo-backend/src/services/cajaSesion.js`.

Formas de pago en egresos (`Egreso.js`): `Efectivo`, `Transferencia`, `Cheque`, `Tarjeta debito`, `Tarjeta de Credito`.

### 9.4 Dashboard ejecutivo

- Endpoint: `GET /api/dashboard/estadisticas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
- **Filtro de fechas** aplica a ingresos/egresos y resumen financiero del período; varios KPIs globales (alumnos, liquidaciones totales) son históricos.
- KPIs superiores: conteos grandes (`kpi-value-count`) vs montos (`isMoneyKpi`).
- **Resumen financiero**: ingresos/egresos período, neto, facturado, abonado, cartera.
- **Ventas por método de pago**: 6 tarjetas fijas, agrupación por `idTipoPago` del catálogo.
- Gráficos: ingresos/egresos por tipo, por mes, certificados, servicios causados (gráfico arriba + tabla abajo sin scroll interno).
- Chips de acceso rápido: Alumnos, Cobros, Caja, etc. (ancho fijo ~10.55rem, alineados izquierda).

Archivos: `dashboard.component.*`, `dashboardStats.js`, `dashboard.service.ts`.

#### Semántica financiera importante

| Métrica | Significado |
|---------|-------------|
| **Cartera por cobrar** | Suma de `saldo` de todas las liquidaciones |
| **Valor facturado** (KPI / liquidaciones) | Suma de `valor` de todas las liquidaciones |
| **Ingresos del período** | Suma de tabla `ingresos` en rango de fechas (caja cobrada) |
| Relación aproximada | Facturado ≈ Abonado + Cartera (por documento de liquidación) |

### 9.5 Certificados

**Académicos (alumno Regular)**

- Elegibles: `GET /api/certificados/elegibles/:numDoc` — liquidaciones con `idProg`, saldo 0, sin certificado previo.
- Emisión: `POST /api/certificados` con plantilla según `tipoFormatoCert`.
- Clasificación de formato: `clasificacionCertificado.js` — prioridad **`prog.tipoCertificado`** → regex nombre (MP) → `idTipCap` → default `curso`.
- Tipos: `curso`, `tecnico`, `competencias`, `diplomado`, `licencia`, `mercancias_peligrosas`, `jornada_capacitacion`.
- Config plantillas: `config/certificado`, `plantillaPorTipo` por tipo.
- Alertas globales: `GET /certificados/alertas-por-vencer`, `alertas-vencidos` (días en config certificados).

**Jornadas**

- Auto-emisión: `certificadoJornadaAuto.js` al cumplir `numSesCert` asistencias.
- Listado aparte: `/app/jornadas/certificados`.

**UI**

- Editor layout (`certificado-layout-editor`), impresión HTML/PDF con QR.
- Ficha alumno → pestaña Certificados; listado global `/app/certificados`.

### 9.6 RRHH y nómina

- Empleados, contratos, catálogos (cargo, EPS, AFP, ARL, cajas compensación).
- Períodos de nómina, novedades, liquidación.
- Config parámetros: `configNomina` en backend init.

### 9.7 Configuración y auditoría

- Usuarios, roles-permisos, catálogos sistema, datos empresa/recibos.
- **Auditoría**: registro de acciones; **Actividad HTTP**: monitoreo de requests.

### 9.8 Jornadas de Capacitación (módulo aparte)

**No confundir** con la colección `contratos` de RRHH. Cadena operativa:

```text
contratacion → jornadasCap → clasesJornadaCap → asisClasJorCap
```

| Colección | Contenido |
|-----------|-----------|
| `contratacion` | Empresa cliente: `codContrato`, razón social, supervisor, `numerojornadas`, `jornadasPorDia`, `numSesCert`, fechas, flags sáb/dom/fest |
| `jornadasCap` | Una “carpa”/día: `idContrato`, `fechaProgramacion`, municipio/depto, `direccion`, georef (`lat`, `lng`, `deteGeorefe`, `codMunicipio`) |
| `clasesJornadaCap` | Clase/sesión dentro de la jornada (solo si jornada **EN PROCESO** hoy) |
| `asisClasJorCap` | Asistencia por `numDoc`; dispara conteo hacia certificado automático |

**Estados de jornada** (automáticos por fecha del sistema, no editables en UI):

- `INACTIVO` — antes del día programado  
- `EN PROCESO` — solo el día programado (permite crear clases)  
- `FINALIZADO` — después del día  

**Reglas de negocio**

- Al **generar jornadas** (`programacionJornadas.js`): `municipio`/`depto` vacíos; **no** copiar `contrato.ciudad` a todas las jornadas.
- Ubicación de cada jornada: selector Divipola manual o georreferenciación (Nominatim + cruce Divipola) — `georefMunicipio.js`, `GET /api/jornadas/jornadas/georef/municipio`.
- `numSesCert` en contrato: al alcanzar N asistencias (clases distintas) en ese contrato → certificado automático.
- Programas con tipo **Jornadas de Capacitación** en catálogo: sin vínculo a `idContrato`; no crean fila en `servicios`.

**Frontend**

| Pantalla | Archivo |
|----------|---------|
| Hub administración | `features/jornadas/jornadas-hub.component.*` |
| Instructor / carpa | `features/jornadas/jornada-instructor.component.*` |
| Mapa jornada | `features/jornadas/jornada-mapa-picker.component.*` |
| Util georef | `features/jornadas/jornada-georefe.util.ts` |

**Menú:** grupo **Jornadas Cap.** → Contratación y jornadas, Alumnos jornada, Clase en carpa.

**Permisos:** `jornadas.ver`, `jornadas.gestionar`, `jornadas.operar`.

**Backend:** `jornadaCapController.js`, `programacionJornadas.js`, `routes/jornadas.js`, constantes `jornadaCapacitacion.js`.

### 9.9 Programación CEA

- Rutas API: `/api/programacion-cea/*` (`programacionCeaController.js`, `programacionCeaAuto.js`).
- Clases grupales y práctica; estados CREADO → PROGRAMADA → FINALIZADO.
- Rastreo por `numDoc`; generación masiva clases pendientes.
- Permisos: `programacion_cea.*`.
- Frontend: `features/programacion-cea/*`, hub con pestañas (config, pendientes, rastreo, calendario).

### 9.10 Vehículos

- CRUD vehículos, documentos adjuntos, requisitos configurables.
- Inspección preoperacional (instructor): permiso `instructores.inspeccion`.
- Alertas: docs vencidos/faltantes, inspección pendiente del día.
- Backend: `vehiculoController.js`, `routes/vehiculos.js`.

### 9.11 Sedes

- Modelo y API: `/api/sedes`.
- Usuario con array `sedes`; filtro en shell si `sedes.ver_todas` y múltiples sedes.
- `idSede` en liquidaciones, matrículas, jornadas según flujo.

### 9.12 Alarmas (UI)

- Configurables por rol junto a permisos (`rolesPermisos.js`, `alarmasCatalogo.js`).
- Banners en `shell.component`: caja, certificados, jornadas, CEA, vehículos, empleados.
- Servicios frontend: `AlarmaService`, `certificado-vencimiento-alert.service`, `certificado-vencido-alert.service`, etc.

---

## 10. Convenciones de código

### Backend

- Controladores delgados; lógica en `services/`.
- Errores con `status` en Error o middleware `error.js`.
- Montos: `Decimal128` en Mongo, helpers `num()`, `roundMoney()` en `coerceTypes.js`.
- Resolución tipo ingreso / forma pago: `tipoIngresoResolver.js`, `tipoIngresoCaja.js`.

### Frontend

- **Standalone components**; lazy load en rutas.
- Estilos globales: `src/styles.scss` (tema oscuro azul, cápsulas `.cap-*`, montos `.kpi-val`, tablas `.data-table`).
- Utilidades: `capsule.util.ts` (badges de estado), `caja-forma-pago.util.ts`, `metodo-pago.util.ts`.
- Impresión informes caja: `caja-informe-print.service.ts` (HTML para print).
- Alumnos jornada vs general: siempre usar `rutasAlumnos(modo)` para navegar; no mezclar `/app/alumnos` con flujo jornadas.
- Ficha alumno: pasar `[modo]` a `argo-datos-principales`; el botón «Lista» en detalle usa `rutas().lista`.

### UI / UX recientes

- Tema oscuro corporativo (`--bg-*`, `--accent-*`).
- Tarjetas KPI y montos con `container-type: inline-size`, `text-overflow: ellipsis`, `title` con valor completo.
- Cierres de caja: vista tarjetas + lista (`caja-cierres-admin`).

---

## 11. Scripts útiles (backend)

```bash
cd argo-backend
pnpm run dev              # nodemon
pnpm run seed             # datos base
pnpm run seed:users
pnpm run seed:catalogos
pnpm run seed:config
pnpm run migrate:numdoc
pnpm run migrate:tipo-alumno
pnpm run migrate:tipo-certificado
pnpm run cea:depurar-clases          # listar
pnpm run cea:depurar-clases:confirmar
pnpm run jornadas:migrar-sede:dry
pnpm run jornadas:migrar-sede
```

---

## 12. Puntos de atención para IAs que modifican el proyecto

1. **No romper RBAC**: cualquier ruta nueva necesita `requirePermiso` en backend y `permiso` + `permisoGuard` en frontend; opcional entrada en `permisosCatalogo.js`.
2. **Caja abierta**: ingresos del turno deben respetar `idSesion` activa del usuario.
3. **Forma de pago**: no mezclar Nequi con Transferencia; usar `idTipoPago` del catálogo como fuente de verdad.
4. **Dashboard**: distinguir métricas de período vs históricas al cambiar `dashboardStats.js`.
5. **PermisoService ↔ AuthService**: sin inyección circular; permisos en localStorage + `setPermisos()` en login.
6. **Commits**: el usuario pide commits solo cuando lo solicita explícitamente.
7. **Idioma**: comunicación con el usuario en **español**.
8. **Jornadas ≠ RRHH**: `contratacion` / `jornadasCap` no son `Contrato` de empleados.
9. **Jornadas ≠ ciudad del contrato**: municipio de cada jornada se define en la jornada (Divipola/georef), no heredar `contrato.ciudad`.
10. **Alumnos jornada**: rutas bajo `/app/jornadas/alumnos*`; lista filtrada por `tipoAlumno`; volver desde ficha a esa lista, no a `/app/alumnos`.
11. **Programas jornada**: no crear servicio de catálogo ni matrícula cobrada al guardar programa tipo jornada.
12. **Effects Angular 19**: no usar `allowSignalWrites` (deprecado); no llamar `toObservable()` fuera del constructor (NG0203).

---

## 13. Archivos “mapa” rápido

| Si necesitas… | Mira primero |
|---------------|--------------|
| Arranque API | `argo-backend/src/server.js`, `app.js` |
| Rutas API | `argo-backend/src/routes/index.js` |
| Permisos | `permisosCatalogo.js`, `rolesPermisos.js`, `auth.js` |
| Caja | `cajaSesion.js`, `routes/caja.js`, `caja-sesion.service.ts` |
| Dashboard stats | `dashboardStats.js`, `dashboard.component.*` |
| Rutas UI | `app.routes.ts`, `shell.component.ts` |
| Login | `authController.js`, `auth.service.ts` |
| Liquidaciones | `liquidacion` routes/controller, `liquidacion.service.ts` |
| Estilos globales | `argo-frontend/src/styles.scss` |
| Alumnos (lista/ficha) | `alumnos-lista.*`, `alumno-detalle.*`, `tabs/datos-principales.*`, `alumno-store.service.ts` |
| Rutas alumnos modo | `alumnos-rutas.helpers.ts` |
| Jornadas Cap. | `jornadaCapController.js`, `programacionJornadas.js`, `georefMunicipio.js`, `jornadas-hub.*` |
| Programación CEA | `programacionCeaController.js`, `programacionCeaAuto.js`, `features/programacion-cea/*` |
| Vehículos | `vehiculoController.js`, `features/vehiculos/*` |
| Certificados / tipos | `certificadoController.js`, `clasificacionCertificado.js` |
| Alarmas | `alarmasCatalogo.js`, `shell.component.ts` |
| Modelo contratación | `models/Contratacion.js` (`codContrato`, `jornadasPorDia`, `numSesCert`) |

---

## 14. Glosario

| Término | Significado en ARGO |
|---------|---------------------|
| CEA | Centro de enseñanza automovilística |
| Liquidación | Deuda/cargo por un servicio vendido al alumno |
| Ingreso | Recibo de pago en caja |
| Sesión de caja | Turno de un cajero (apertura → cierre) |
| Cuadre | Resumen del turno antes de cerrar |
| Descuadre | Diferencia entre efectivo contado y esperado |
| `numDoc` | Número de documento del alumno (PK lógica) |
| `idTipoPago` | FK al catálogo de medios de pago |
| **Contratación** | Contrato con empresa para jornadas de capacitación (colección `contratacion`) |
| **codContrato** | Código/referencia interna del contrato de jornadas |
| **Jornada (Cap.)** | Registro en `jornadasCap` — un día/sede de operación |
| **Clase (jornada)** | Sesión en `clasesJornadaCap`; equivale a “sesión” para certificado |
| **tipoAlumno** | `Regular` (CEA clásico) o `Jornadas de Capacitación` (sin cobro matrícula en módulo jornadas) |
| **numSesCert** | Nº de asistencias (clases distintas) para emitir certificado automático en el contrato |
| **deteGeorefe** | `MAPA`, `DISPOSITIVO_MOVIL` o `MANUAL` — origen del municipio/ubicación de la jornada |

---

*Fin del documento. Módulos activos recientes: jornadas, programación CEA, vehículos, certificados, caja, sedes, alarmas. Requisitos funcionales: [ARGO-ESPECIFICACIONES.md](./ARGO-ESPECIFICACIONES.md).*
