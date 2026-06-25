# ARGO — Fact sheet del producto

Resumen ejecutivo del estado actual del software. **Mayo 2026.**

---

## Identidad

| Campo | Valor |
|-------|--------|
| **Nombre** | ARGO |
| **Tipo** | ERP vertical para CEAs y centros de formación vial (Colombia) |
| **Estado** | En producción operativa / desarrollo activo |
| **Moneda / locale** | COP · `es-CO` |
| **Repositorio** | Monorepo: `argo-backend` + `argo-frontend` |

---

## Propuesta de valor

ARGO cubre el ciclo operativo de un CEA en un solo sistema:

- Matricular alumnos, cobrar servicios y controlar caja por turno.
- Emitir certificados con plantillas por tipo (curso, licencia, mercancías peligrosas, jornadas, etc.).
- Programar clases CEA (teoría, taller, práctica) e instructores.
- Gestionar jornadas de capacitación empresarial (contratos, carpas, asistencia, certificado automático).
- Administrar flota vehicular, documentos e inspección preoperacional.
- RRHH, nómina, roles granulares, auditoría y alarmas operativas.

---

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 20+, Express 4, Mongoose 8, JWT |
| Frontend | Angular 19 (standalone, signals) |
| Base de datos | MongoDB |
| Paquetes | pnpm |

---

## Módulos — matriz de madurez

| Módulo | Estado | Notas |
|--------|--------|-------|
| Alumnos (ficha, documentos, OCR cédula) | ✅ Operativo | Flujos Regular y Jornadas Cap. |
| Programas y servicios | ✅ Operativo | Formato certificado (`tipoCertificado`) por programa |
| Matrículas y liquidaciones | ✅ Operativo | Cartera, abonos, saldos |
| Caja (turno, arqueo, cierres) | ✅ Operativo | Descuadres, cierre general multi-caja |
| Certificados académicos | ✅ Operativo | Elegibles pagados, plantillas, QR, alertas vencimiento |
| Dashboard ejecutivo | ✅ Operativo | KPIs, gráficos, resumen financiero |
| Jornadas de capacitación | ✅ Operativo | Contratación → jornadas → clases → certificado auto |
| Programación CEA | ✅ Operativo | Teoría/taller/práctica, rastreo alumno, clases pendientes |
| Vehículos | ✅ Operativo | Documentos, alertas, inspección instructor |
| Instructores / portal | ✅ Operativo | Hub instructores, mis clases, inspección |
| RRHH y nómina | ✅ Operativo | Empleados, contratos, períodos, novedades |
| Sedes multi-sede | ✅ Operativo | Filtro por sede, permisos `sedes.*` |
| Configuración y RBAC | ✅ Operativo | Usuarios, roles, permisos y alarmas por rol |
| Auditoría / actividad HTTP | ✅ Operativo | Logs y monitor de recursos |
| **Facturación electrónica** | ⏳ Pendiente | Pantalla placeholder; sin integración DIAN |

---

## Roles y seguridad

- Autenticación **JWT**; permisos en BD (`RolApp`) + catálogo en código.
- Roles semilla: `admin`, `cajero`, `instructor`, `recepcion`, `usuario`.
- **Alarmas** configurables por rol (`alarmasCatalogo.js`): caja, certificados, vehículos, CEA, jornadas, instructores.

---

## Formatos de certificado soportados

| ID | Uso típico |
|----|------------|
| `curso` | Cursos no formales |
| `tecnico` | Técnico laboral |
| `competencias` | Capacitación por competencias |
| `diplomado` | Diplomados |
| `licencia` | Licencia de conducción |
| `mercancias_peligrosas` | Transporte mercancías peligrosas |
| `jornada_capacitacion` | Jornadas empresariales |

Clasificación: campo **`tipoCertificado`** del programa (prioridad) → nombre del programa → tipo de capacitación.

---

## Despliegue típico

- Servidor local o VPS en LAN: API `:3000`, SPA `:4200`.
- Frontend resuelve API por hostname del navegador (acceso desde otros PCs en red).
- Archivos subidos en `uploads/` del backend.

---

## Documentación relacionada

| Documento | Audiencia |
|-----------|-----------|
| [README.md](./README.md) | Inicio rápido, instalación |
| [ARGO-ESPECIFICACIONES.md](./ARGO-ESPECIFICACIONES.md) | Requisitos funcionales y reglas de negocio |
| [ARGO-CONTEXTO.md](./ARGO-CONTEXTO.md) | Arquitectura, API, rutas, convenciones (desarrolladores / IA) |
| [argo-frontend/README.md](./argo-frontend/README.md) | Notas Angular |

---

## Pendientes conocidos (roadmap corto)

- Módulo de **facturación electrónica** (DIAN / FE).
- Refinar inferencia automática de **formato certificado** al crear programas MP.
- Ampliar pruebas automatizadas e2e.
- Empaquetado SaaS / instalador producción (hoy orientado a despliegue LAN).

---

*Proyecto privado. Actualizar este fact sheet cuando cambie el alcance de un módulo mayor.*
