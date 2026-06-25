# Cuenta de soporte maestro (break-glass) — Guía de configuración

Guía para activar el acceso de soporte del proveedor en **cada instalación nueva** de ARGO.

## ¿Qué es?

Una cuenta de administrador que **no vive en la base de datos**: sus credenciales están en
las variables de entorno del servidor (`deploy/.env`). Sirve para que el proveedor pueda
entrar a cualquier instancia para dar soporte.

Características:

- **No aparece** en la pantalla de usuarios; nadie la puede ver, editar ni borrar desde la app.
- **Sobrevive** a una puesta en cero o a una restauración de respaldo.
- **Exige siempre 2FA** (código de Google Authenticator).
- **Queda registrada en la auditoría** (cada ingreso y cada acción), como exige ISO/IEC 27001.
- Es **distinta por instalación**: cada servidor tiene su propia contraseña y su propio QR.

> Recomendación: use un **usuario, contraseña y QR diferentes en cada cliente**. Así, si en un
> servidor se expone la clave, no sirve para los demás. En su Authenticator tendrá una entrada
> por cada cliente.

---

## Requisitos

- Acceso SSH al servidor, en la carpeta del proyecto (ejemplo: `/opt/argo`).
- El backend desplegado con Docker Compose.
- Google Authenticator (o similar) en su celular.

---

## Pasos

### 1. Traer el código y reconstruir el backend (solo la primera vez o tras cambios)

```bash
cd /opt/argo
git pull origin main
docker compose build argo-backend
docker compose up -d argo-backend
```

### 2. Generar las credenciales dentro del contenedor

El comando muestra un **QR en la terminal** y escribe el resultado en un archivo dentro de
`data/backups/` (carpeta visible desde el host). Cambie `soporte` y la contraseña por las suyas:

```bash
docker compose exec argo-backend node scripts/soporte-maestro-setup.js --user soporte "SuClaveSegura" --env /app/backups/soporte.env
```

> La contraseña se guarda en **texto plano** (variable `SOPORTE_MASTER_PASSWORD`).
> **No use un hash bcrypt**: Docker Compose corrompe los caracteres `$` del hash al cargar el
> `env_file`. El segundo factor (TOTP) es la defensa real de la cuenta.

**Escanee el QR** que aparece en la terminal con Google Authenticator.
Si la ventana SSH es angosta y el QR se ve cortado, en el Authenticator elija
**"Ingresar clave de configuración"** y escriba a mano el `Secreto TOTP` que imprime el script.

### 3. Mezclar las credenciales en `deploy/.env` (sin copiar a mano)

```bash
cd /opt/argo
grep -v '^SOPORTE_MASTER_' deploy/.env > deploy/.env.new
cat data/backups/soporte.env >> deploy/.env.new
mv deploy/.env.new deploy/.env
rm data/backups/soporte.env
```

Esto elimina cualquier línea `SOPORTE_MASTER_*` anterior y deja solo las nuevas, sin duplicados.

### 4. Recargar el `.env` en el backend

```bash
docker compose up -d --force-recreate argo-backend
```

> Importante: Docker Compose **no recarga el `.env` con un simple `restart`**. Use siempre
> `--force-recreate` para que el contenedor tome las variables nuevas.

### 5. Verificar

```bash
docker compose exec argo-backend node -e "const s=require('./src/services/soporteMaestro'); console.log('habilitado:', s.habilitado(), '| user:', process.env.SOPORTE_MASTER_USER, '| tienePassword:', !!process.env.SOPORTE_MASTER_PASSWORD, '| secretLen:', (process.env.SOPORTE_MASTER_TOTP_SECRET||'').length);"
```

Debe mostrar: `habilitado: true | user: soporte | tienePassword: true | secretLen: 32`
y **sin** ningún `WARN ... variable is not set`.

### 6. Probar el ingreso

En la pantalla de login normal del ERP:

1. Usuario: el que puso (ej. `soporte`).
2. Contraseña: la que eligió.
3. Código de 6 dígitos del Authenticator.

Debe entrar como administrador con acceso total.

---

## Operaciones útiles

### Cambiar la contraseña o renovar el QR

Repita los pasos 2 a 4 con otra contraseña. Se generará un secreto TOTP nuevo, así que
deberá **borrar la entrada anterior** en el Authenticator y escanear el QR nuevo.

### Deshabilitar la cuenta

En `deploy/.env` cambie:

```
SOPORTE_MASTER_ENABLED=false
```

Y recargue:

```bash
docker compose up -d --force-recreate argo-backend
```

O elimine las cuatro líneas `SOPORTE_MASTER_*` por completo.

### Ver los ingresos de soporte en la auditoría

Cada login de esta cuenta queda con la acción `login_soporte_maestro` y todas sus acciones
se registran con el usuario indicado. Consúltelos en el módulo de auditoría del ERP o en
`logs/auditoria/` del servidor.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| "Credenciales inválidas" y **no pide** el código 2FA | Las variables no están en el contenedor, o la cuenta está deshabilitada | Verifique con el paso 5; use `--force-recreate` |
| Aparece `WARN "..." variable is not set` al levantar | Quedó un `SOPORTE_MASTER_PASSWORD_HASH` con `$` en el `.env` | Use `SOPORTE_MASTER_PASSWORD` (texto plano); rehaga el paso 3 |
| El código del Authenticator siempre es incorrecto | El secreto del `.env` no coincide con el del QR (se copió mal) o desfase de reloj | Rehaga con `--env` (no copie a mano); active la hora automática en el celular |
| `Cannot find module 'bcryptjs'` al correr el script en el host | Las dependencias viven dentro del contenedor | Ejecute el script con `docker compose exec argo-backend node scripts/...` |

---

## Resumen rápido (copiar y pegar)

```bash
cd /opt/argo
git pull origin main
docker compose build argo-backend && docker compose up -d argo-backend
docker compose exec argo-backend node scripts/soporte-maestro-setup.js --user soporte "SuClaveSegura" --env /app/backups/soporte.env
# (escanee el QR)
grep -v '^SOPORTE_MASTER_' deploy/.env > deploy/.env.new
cat data/backups/soporte.env >> deploy/.env.new
mv deploy/.env.new deploy/.env
rm data/backups/soporte.env
docker compose up -d --force-recreate argo-backend
```
