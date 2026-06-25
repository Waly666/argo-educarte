# ARGO — Especificaciones funcionales

Documento de requisitos y comportamiento esperado del producto. Complementa la guía técnica [ARGO-CONTEXTO.md](./ARGO-CONTEXTO.md). **Mayo 2026.**

---

## 1. Objetivo del sistema

ARGO debe permitir a un **Centro de Enseñanza Automovilística (CEA)** u operador de formación vial en Colombia:

1. Registrar y dar seguimiento a **alumnos** (aspirantes y conductores).
2. Vender **servicios/programas**, generar **liquidaciones** y registrar **pagos** en caja.
3. **Certificar** alumnos cuando cumplan condiciones de pago y documentación.
4. **Programar** actividad académica (clases CEA, jornadas empresariales).
5. **Controlar** caja, flota vehicular, personal y cumplimiento documental.
6. Operar con **trazabilidad** (auditoría, roles, alarmas).

---

## 2. Usuarios y perfiles

| Perfil | Necesidades principales |
|--------|-------------------------|
| **Administrador** | Configuración global, roles, catálogos, cierres, reportes |
| **Recepción / académico** | Alumnos, matrículas, programas, certificados |
| **Cajero** | Apertura de turno, cobros, recibos, cuadre y cierre |
| **Instructor** | Clases del día (jornadas o CEA), asistencia, inspección vehículos |
| **RRHH** | Empleados, contratos, nómina |
| **Consulta** | Lectura limitada según permisos |

Los permisos no son fijos en código: se asignan por **rol** en Configuración → Roles, permisos y alarmas.

---

## 3. Módulos funcionales

### 3.1 Alumnos

**Requisitos**

- CRUD de ficha con datos demográficos, contacto, tipo de alumno (`Regular` | `Jornadas de Capacitación`).
- Pestañas: Datos principales, Servicios, Pagos, Certificados, Documentos.
- Búsqueda por documento, nombre; lista general y lista filtrada para jornadas.
- Escaneo OCR de cédula (opcional) para precargar datos.
- Validación de documentos requeridos (configurable); aviso en certificados si faltan (no bloquea emisión por defecto).

**Reglas**

- `numDoc` numérico, 6–11 dígitos, único por alumno.
- Rutas jornada bajo `/app/jornadas/alumnos*`; flujo general bajo `/app/alumnos*`.

---

### 3.2 Programas y servicios

**Requisitos**

- Catálogo de programas con tarifas, horas, vigencia certificado, servicio de matrícula vinculado.
- Campo **Formato de certificado** (`tipoCertificado`): automático o explícito (curso, licencia, MP, etc.).
- Servicios ad hoc (trámites, horas práctica, etc.) administrables aparte.

**Reglas**

- Programas tipo **Jornada Capacitación** no generan servicio de matrícula cobrable en flujo jornadas.
- El formato de certificado explícito en programa **tiene prioridad** sobre detección por nombre.
- Programas con nombre “mercancías peligrosas” deben configurarse como `mercancias_peligrosas` si el formato inferido quedó en `curso`.

---

### 3.3 Matrículas, liquidaciones y pagos

**Requisitos**

- Al matricular: crear matrícula + liquidación con `valor`, `abonado`, `saldo`, `estado`.
- Cobros desde caja o ficha alumno; recibo imprimible.
- Vista de cobros pendientes (cartera).

**Reglas**

- `estado`: `pendiente` | `parcial` | `pagado` según abonado vs valor.
- Certificado académico elegible solo si `saldo ≤ 0` y no existe certificado para esa liquidación.
- Forma de pago canónica vía catálogo `catTipoPago` (`idTipoPago`).

---

### 3.4 Caja

**Requisitos**

- Apertura de sesión personal por cajero.
- Ingresos y egresos del turno; arqueo de efectivo.
- Cierre de turno con resumen; autorización admin si hay descuadre.
- Administración: todos los ingresos/egresos, historial de cierres, descuadres, **cierre general** multi-caja.
- Banner si el usuario con permiso de caja no tiene turno abierto.

**Reglas**

- Movimientos del turno asociados a `idSesion` activa.
- Medios de pago agrupados en dashboard y cuadre (Efectivo, Transferencia, tarjetas, Nequi/Daviplata, etc.).

---

### 3.5 Certificados académicos

**Requisitos**

- Listar programas **elegibles** (pagados, sin certificado previo).
- Emitir con plantilla según tipo de formato; campos acta, folio, RUNT, fechas.
- Editar, anular e imprimir (HTML/PDF con QR según config).
- Listado global de certificados emitidos.
- Alarmas: certificados **por vencer** y **vencidos** (días configurables en Config. Certificados).

**Reglas**

- Tipos de formato: ver [ARGO-FACTO.md](./ARGO-FACTO.md#formatos-de-certificado-soportados).
- Certificados de jornada (`generadoAutoJornada`, `idJornada`) se gestionan en módulo jornadas, no en elegibles académicos clásicos.

---

### 3.6 Jornadas de capacitación

**Requisitos**

- Contratación con empresa (código contrato, jornadas, sesiones para certificar).
- Generación de jornadas por calendario; estados automáticos por fecha (`INACTIVO` | `EN PROCESO` | `FINALIZADO`).
- Clases en carpa, registro de asistencia por documento.
- Certificado automático al alcanzar `numSesCert` asistencias en el contrato.
- Georreferenciación de jornada (Divipola / mapa).

**Reglas**

- `contratacion` ≠ contratos RRHH de empleados.
- Municipio de cada jornada se define en la jornada, no se hereda del contrato.

---

### 3.7 Programación CEA

**Requisitos**

- Hub: configuración, temas, rastreo por alumno, clases pendientes, calendario.
- Clases grupales (teoría/taller) y práctica en vehículo.
- Inscripción, inicio/finalización de clase, clases del día.
- Generación masiva de clases pendientes.
- Alarmas: clases pendientes de programar, clase próxima, clases CREADO en ficha alumno.

**Reglas**

- Permisos: `programacion_cea.ver`, `.gestionar`, `.operar`.

---

### 3.8 Vehículos

**Requisitos**

- Ficha vehículo: placa, marca, línea, documentos adjuntos.
- Requisitos documentales configurables (vencimiento).
- Inspección preoperacional por instructor.
- Alarmas: docs vencidos, faltantes, inspección pendiente del día.

---

### 3.9 Instructores

**Requisitos**

- Hub de instructores vinculados a empleados.
- Portal: mis clases, alertas de clase asignada/próxima, inspección requerida.
- Permiso `instructores.inspeccion` para inspección vehicular.

---

### 3.10 RRHH y nómina

**Requisitos**

- Empleados, contratos laborales, catálogos (cargo, EPS, AFP, ARL, cajas).
- Períodos de nómina, novedades, liquidación.
- Config parámetros nómina en sistema.
- Documentos empleado con alarmas de vencimiento/faltantes.

---

### 3.11 Sedes

**Requisitos**

- Catálogo de sedes; usuario puede tener sedes asignadas.
- Filtro global por sede en shell (si permiso `sedes.ver_todas` y varias sedes).
- Matrículas/jornadas pueden asociar `idSede`.

---

### 3.12 Dashboard

**Requisitos**

- Filtro por rango de fechas para ingresos/egresos del período.
- KPIs: alumnos, liquidaciones, cartera, certificados, etc.
- Gráficos por tipo de ingreso/egreso y evolución mensual.
- Ventas por método de pago (6 categorías fijas).

**Semántica financiera**

| Métrica | Definición |
|---------|------------|
| Cartera | Suma de `saldo` en liquidaciones |
| Valor facturado | Suma de `valor` en liquidaciones |
| Ingresos del período | Suma de ingresos en rango de fechas |

---

### 3.13 Configuración

| Área | Contenido |
|------|-----------|
| Usuarios | Alta, roles, sedes, credenciales |
| Roles | Permisos + alarmas por rol |
| Sedes | CRUD sedes |
| Catálogos | Tipos pago, ingreso, egreso, demografía, etc. |
| Recibos | Datos empresa, formato comprobantes |
| Certificados | Plantillas por tipo, QR, días alerta vencimiento |
| Requisitos docs | Alumnos, vehículos, empleados |
| Inspección vehículos | Formato checklist |
| Georef | Parámetros mapas / Nominatim |
| Nómina | Parámetros legales/técnicos |
| Auditoría | Log acciones + monitor HTTP/recursos |

---

### 3.14 Facturación (pendiente)

**Estado actual:** ruta `/app/facturacion` muestra placeholder.

**Requisito futuro esperado:** integración facturación electrónica Colombia (DIAN), notas crédito/débito, numeración, reporte fiscal.

---

## 4. Alarmas del sistema

Las alarmas se activan por rol. Grupos principales:

- **Caja:** turno cerrado, cobrar sin caja, descuadres.
- **Certificados:** por vencer, vencidos.
- **Jornadas:** en proceso hoy, certificado nuevo, toast live.
- **Programación CEA:** pendientes, clase próxima, clases creado en alumno.
- **Instructores:** clase asignada/próxima, inspección requerida.
- **Vehículos / empleados:** documentos vencidos o faltantes, inspección pendiente.
- **Alumnos (ficha):** saldos, documentos pendientes.

Catálogo completo: `argo-backend/src/constants/alarmasCatalogo.js`.

---

## 5. Requisitos no funcionales

| Área | Especificación |
|------|----------------|
| Idioma UI | Español (Colombia) |
| Moneda | COP, sin decimales en UI |
| Autenticación | JWT; expiración configurable (`JWT_EXPIRES`) |
| Multi-usuario | Concurrente sobre misma BD |
| Red | LAN: frontend y API en misma IP lógica |
| Auditoría | Registro de operaciones sensibles |
| Respaldos | Responsabilidad operativa del cliente (MongoDB) |

---

## 6. Integraciones externas

| Integración | Uso |
|-------------|-----|
| MongoDB | Persistencia |
| Nominatim / georef | Ubicación jornadas (configurable) |
| Tesseract.js | OCR cédula |
| QR en certificados | Verificación opcional |

No hay integración DIAN/RUNT en tiempo real documentada en esta versión.

---

## 7. Criterios de aceptación transversales

1. Todo endpoint nuevo protegido con `requirePermiso` acorde al catálogo.
2. Toda ruta UI nueva con `permisoGuard` y entrada en menú filtrada.
3. Montos monetarios consistentes entre liquidación, ingreso y dashboard.
4. Certificado no duplicado por misma liquidación.
5. Caja: no registrar ingreso de turno sin sesión abierta del usuario (salvo flujos admin explícitos).

---

## 8. Historial de alcance

| Versión doc | Cambios relevantes |
|-------------|-------------------|
| Mayo 2026 | Programación CEA, vehículos, sedes, alarmas certificados vencidos, RBAC ampliado, cierre general caja |

---

*Para mapa de rutas API, modelos MongoDB y convenciones de código, ver [ARGO-CONTEXTO.md](./ARGO-CONTEXTO.md).*
