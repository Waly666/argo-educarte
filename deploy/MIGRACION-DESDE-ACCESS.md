# Migración desde Microsoft Access (.accdb / .accdr) hacia ARGO

Guía operativa: **reinicio limpio** del ERP + **importación** desde la app anterior (Access).

---

## Resumen del flujo

```
Access (.accdb)  →  exportar / mapear  →  Excel plantilla ARGO  →  Validar  →  Importar
        ↑                                                                    ↑
   (app vieja)                                                    Sistema → Migración de datos
```

Antes de importar, conviene **poner ARGO en cero** (con respaldo) para no mezclar datos de prueba con los reales.

---

## Parte 1 — Reinicio completo (ERP)

Solo **administrador**. Ruta: **Sistema → Puesta en cero** (`/app/configuracion/reset`).

### Orden recomendado

1. **Descargar copia de seguridad** (Sistema → Copias de seguridad) — por si hay algo que recuperar.
2. **Puesta en cero completa**:
   - Frase de confirmación: `REINICIAR EMPRESA`
   - Contraseña admin (+ MFA si está activo)
   - Dejar **reset completo** (no parcial) si van a migrar todo desde Access
3. El sistema crea **respaldo automático previo** y borra:
   - Alumnos, matrículas, pagos, certificados
   - Programas, sedes, jornadas, cohortes, contratos capacitación
   - Caja, clientes facturación, facturas electrónicas
   - RRHH operativo, vehículos, aula virtual, auditoría
4. **Conserva** catálogos base (tipos documento, EPS, AFP, tipos capacitación, etc.) y su usuario admin.

### Reset parcial (solo si lo necesitan)

Módulos disponibles (incluye tablas nuevas):

| Módulo | Qué borra |
|--------|-----------|
| Académico | Alumnos, matrículas, liquidaciones, certificados |
| Contable y caja | Ingresos, egresos, caja, clientes FE, facturas |
| Programación CEA y jornadas | CEA, **contratacion** (contratos empresas), jornadasCap |
| **Cohortes académicas** | Semestres, materias, cohortes, inscripciones, evaluaciones |
| Programas, sedes… | Programas, servicios, combos, sedes, aulas |
| RRHH | Empleados, contratos **laborales** (no confundir con contratacion) |
| Aula virtual | Portal, progreso, usuarios portal |
| Usuarios ERP | Todo el personal excepto quien ejecuta |
| Configuración | Consecutivos y config a fábrica |

Para migración **desde cero**, use **reset completo**.

### Después del reset — configurar base

1. **Configuración → Empresa y comprobantes** (NIT, razón social, logos).
2. **Configuración → Sedes** (al menos una sede activa).
3. **Configuración → Catálogos** — revisar tipos de capacitación (deben coincidir con los nombres que usarán en Excel).
4. **Usuarios del personal** — cajeros, académico, etc.
5. (Opcional) **Programas** manualmente antes de migrar, o incluir hoja **Programas** en el Excel.

---

## Parte 2 — Qué trae la migración ARGO hoy

Ruta: **Sistema → Migración de datos** (`/app/configuracion/migracion`).

| Hoja Excel | Contenido |
|------------|-----------|
| **Programas** | Código, nombre, tipo capacitación, horas, **semestres**, tarifas |
| **Alumnos** | Documento, nombres, contacto |
| **Matriculas** | Alumno + programa + valor total + **valor pagado** → calcula saldo |
| **Pagos** | Recibos históricos del sistema anterior |
| **Certificados** | Emitidos (modo normal o **histórico** sin exigir alumno/programa) |

Descargue la **plantilla** desde la misma pantalla, elija qué hojas incluir y use **Validar archivo** antes de **Importar**.

> **Técnicos por semestre:** la plantilla actual migra matrícula con un saldo agregado. El detalle semestre a semestre (S1 pagado, S2 pagado…) lo veremos en una fase 2; por ahora use `valorPagado` = lo ya pagado en Access y `valorTotal` = deuda total o valor del programa según tengan el dato.

---

## Parte 3 — Access: ¿se puede analizar?

**Sí, pero no directamente desde el repositorio.** El archivo `.accdb` es binario; hay que:

1. Tener el archivo en el PC (ej. `C:\datos\Finstruvial.accdb`).
2. Usar los scripts de este repo (requieren **Microsoft Access Database Engine** / ODBC en Windows).
3. O exportar manualmente desde Access: **Datos externos → Excel** por cada tabla importante.

### Script 1 — Inspeccionar tablas y columnas

En Windows, desde la carpeta del backend:

```powershell
cd c:\proyectos-js\ARGO\argo-backend
pip install pyodbc
python scripts/access-inspect.py "C:\ruta\a\su\base.accdb"
```

Muestra todas las tablas y columnas. Con eso definimos el mapeo Access → ARGO.

### Script 2 — Generar Excel para migración (borrador)

1. Copie `scripts/access-migracion.mapping.example.json` → `access-migracion.mapping.json`
2. Edite nombres de tablas/columnas según su Access
3. Ejecute:

```powershell
python scripts/access-to-argo-xlsx.py "C:\ruta\a\su\base.accdb" access-migracion.mapping.json salida-migracion.xlsx
```

4. Revise el Excel, corrija filas raras
5. Suba en **Sistema → Migración → Validar → Importar**

### Si no instalan Python/ODBC

En Access abra cada tabla → **Exportar → Excel**:

| Tabla Access (ejemplos habituales) | Hoja ARGO |
|-----------------------------------|-----------|
| Programas / Cursos | Programas |
| Alumnos / Estudiantes | Alumnos |
| Matriculas / Inscripciones | Matriculas |
| Pagos / Recibos / Caja | Pagos |
| Certificados | Certificados |

Renombre columnas a los encabezados exactos de la plantilla ARGO (fila 1).

---

## Parte 4 — Mapeo conceptual Access → ARGO

Ajuste según **sus** nombres reales (el script `access-inspect` los lista).

| Concepto Access | Campo ARGO (Alumnos) |
|-----------------|----------------------|
| Cédula / Documento | `numDoc` (solo números) |
| Primer nombre | `nombre1` |
| Segundo nombre | `nombre2` |
| Primer apellido | `apellido1` |
| Segundo apellido | `apellido2` |
| Celular | `celular` |
| Email | `correo` |

| Concepto Access | Campo ARGO (Matriculas) |
|-----------------|-------------------------|
| ID programa / código curso | `codigoPrograma` |
| Valor matrícula | `valorTotal` |
| Total pagado | `valorPagado` |
| Fecha matrícula | `fechaMatricula` |

| Concepto Access | Campo ARGO (Programas) |
|-----------------|------------------------|
| Código interno | `codigoPrograma` |
| Nombre | `nombrePrograma` |
| Tipo (licencia, técnico…) | `tipoCapacitacion` (= catálogo ARGO) |
| Nº semestres (técnicos) | `semestres` (ej. `4`) |
| Precio | `tarifa1` |

---

## Parte 5 — Checklist migración producción

### En VPS / servidor (antes de migrar datos)

```bash
cd /opt/argo
git pull origin main
docker compose build argo-backend argo-frontend
docker compose up -d --force-recreate argo-backend argo-frontend
```

### En ERP (admin)

- [ ] Copia de seguridad descargada
- [ ] Puesta en cero completa ejecutada
- [ ] Empresa, sede y catálogos revisados
- [ ] Plantilla Excel generada desde Access
- [ ] **Validar archivo** sin errores críticos
- [ ] **Importar** en horario de bajo movimiento
- [ ] Revisar muestra: 10 alumnos, saldos, certificados consulta pública
- [ ] Ajustar consecutivos si hace falta (recibos/certificados) en Configuración

---

## Parte 6 — Qué NO migra este Excel (fase posterior)

- Avance académico por cohorte (semestre 2/3, materias aprobadas)
- Contratos con empresas (jornadas) — se cargan en ARGO aparte
- Empleados / nómina / vehículos
- Clases CEA programadas

Eso se hace en ARGO después de la migración base o con procesos adicionales.

---

## Documentación relacionada

| Archivo | Contenido |
|---------|-----------|
| [GUIA-GIT-DESPLIEGUE.md](./GUIA-GIT-DESPLIEGUE.md) | Git push y Docker en VPS |
| [SEGURIDAD-RESPALDOS-ISO27001.md](./SEGURIDAD-RESPALDOS-ISO27001.md) | Respaldos y puesta en cero |
| [../COHORTES-ACADEMICAS.md](../COHORTES-ACADEMICAS.md) | Técnicos por semestre (post-migración) |

---

*Última actualización: junio 2026 — incluye módulo reset Cohortes académicas y contratacion en jornadas.*
