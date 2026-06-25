# ARGO — Respaldos, puesta en cero y migración (alineación ISO/IEC 27001)

Módulo **Sistema** del ERP (`/app/sistema`, solo administradores) y API `/api/sistema/*`.

## 1. Qué incluye

| Función | Dónde | Qué hace |
|---|---|---|
| Copias de seguridad | Sistema → Copias de seguridad | Copia completa: base de datos (todas las colecciones, formato EJSON) + archivos subidos (`uploads/`). Manual y automática diaria con rotación. |
| Restauración | Misma página | Reemplaza todo con el contenido de una copia (del servidor o subida). Crea copia de seguridad del estado actual antes de pisar nada. |
| Puesta en cero | Sistema → Puesta en cero | Borra datos transaccionales, conserva catálogos, deja consecutivos en 0, conserva solo al admin ejecutor. Copia previa obligatoria. |
| Migración | Sistema → Migración de datos | Importa alumnos, matrículas (con saldo), pagos y certificados desde plantilla Excel estándar. Valida antes de escribir y sincroniza consecutivos. |

## 2. Mapa de controles ISO/IEC 27001:2022 (Anexo A)

| Control | Cómo se cumple en ARGO |
|---|---|
| **8.13 Respaldo de la información** | Copia automática diaria programable (hora y retención en Sistema → Copias de seguridad), copia manual bajo demanda, copia forzosa antes de restaurar o poner en cero. Verificación de integridad por SHA-256 en cada archivo (`*.meta.json`). |
| **8.24 Uso de criptografía** | Cifrado AES-256-GCM de los respaldos en reposo cuando `BACKUP_CLAVE_CIFRADO` está definida en `deploy/.env`. Sin la clave el archivo no puede restaurarse. |
| **5.15 / 8.2 Control de acceso** | Todo el módulo exige rol administrador (middleware `requireAdmin`). Restaurar y poner en cero exigen además reautenticación: contraseña + código TOTP (si MFA activo) + frase de confirmación escrita. |
| **8.15 Registro de eventos** | Cada operación (crear/descargar/eliminar/restaurar respaldo, reset, importación) queda en la colección `auditoria` y en `logs/auditoria/auditoria-AAAA-MM-DD.log` con usuario, IP y resultado. Los intentos de reautenticación fallidos quedan en `logs/auth/`. |
| **8.10 Eliminación de la información** | La puesta en cero elimina datos y archivos del cliente saliente de forma controlada y trazable, con respaldo previo entregable al cliente. |
| **5.29 Continuidad** | Restauración probada de extremo a extremo (BD + archivos + índices). Copias descargables para custodia externa (recomendado: copia fuera del VPS al menos semanal). |
| **8.12 Prevención de fuga de datos** | La descarga de respaldos requiere sesión admin y queda auditada. Los respaldos cifrados son ilegibles fuera del servidor sin la clave. |

## 3. Operación recomendada (por instalación / cliente)

1. **Activar cifrado**: en `/opt/argo/deploy/.env` definir `BACKUP_CLAVE_CIFRADO` (frase larga única por cliente). Guardar la clave en un gestor de contraseñas, **fuera del VPS**.
2. **Programación**: copia automática diaria (por defecto 02:30, retención 30 días). El archivo queda en `/opt/argo/data/backups`.
3. **Custodia externa**: descargar al menos una copia semanal desde el ERP y guardarla fuera del servidor (disco cifrado, drive corporativo).
4. **Prueba de restauración**: trimestral, restaurar una copia en un entorno de prueba.
5. **Alta de un cliente nuevo en un VPS reutilizado**:
   - Descargar y entregar/archivar la última copia del cliente anterior.
   - Sistema → Puesta en cero (queda auditado y con copia previa automática).
   - Configurar empresa (Configuración → Empresa y comprobantes), sede, usuarios.
   - Si el cliente trae datos: Sistema → Migración de datos (plantilla → validar → importar).

## 4. Detalles técnicos

- **Formato del respaldo**: ZIP con `manifest.json`, `db/<colección>.jsonl` (EJSON canónico) y `uploads/`. Cifrado: contenedor `.argobk` = `ARGOBK1` + IV + AES-256-GCM + tag.
- **Ubicación**: `BACKUP_DIR` (por defecto `backups/`, montado en Docker como `./data/backups`).
- **Consecutivos**: viven en la colección `config` (claves `recibo`, `certificado`, `formatoInspeccionVehiculos`). La puesta en cero los regresa a 0; la migración los sube hasta el máximo importado para evitar choques.
- **Reset — se conserva**: catálogos (`programas`, `servicios`, `divipola`, tipos, bancos, EPS/AFP/ARL, cargos, temarios CEA, etc. — lista en `argo-backend/src/constants/cicloVidaColecciones.js`), el usuario admin ejecutor y una sede `PRINCIPAL`.
- **Reset — se elimina**: todo lo demás, incluida configuración (vuelve a fábrica), plantillas de certificado, usuarios restantes, usuarios del portal, logs de auditoría previos (queda el registro del reset) y la carpeta `uploads/`.
- **Migración**: plantilla Excel con hojas `Alumnos`, `Matriculas`, `Pagos`, `Certificados` (descargable desde el ERP con instrucciones y ejemplos). Los registros importados quedan marcados con `migrado: true` y `loteMigracion`; historial en la colección `migracionLotes`.
