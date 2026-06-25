# Guía definitiva: commit, subir a GitHub y desplegar ARGO

Esta guía cubre el flujo completo desde tu PC (Windows) hasta el servidor de producción con Docker Compose.

---

## Resumen del flujo

```
PC (desarrollo)  →  git commit  →  git push  →  GitHub
                                                    ↓
Servidor         ←  docker compose up  ←  git pull
```

| Paso | Dónde | Qué hace |
|------|-------|----------|
| 1 | PC | Revisar cambios (`git status`) |
| 2 | PC | Agregar archivos (`git add`) |
| 3 | PC | Guardar snapshot (`git commit`) |
| 4 | PC | Enviar a GitHub (`git push`) |
| 5 | Servidor | Descargar cambios (`git pull`) |
| 6 | Servidor | Reconstruir imágenes Docker (`docker compose build`) |
| 7 | Servidor | Reiniciar contenedores (`docker compose up -d`) |

---

## Parte A — En tu PC (Windows / PowerShell)

### 1. Ir a la carpeta del proyecto

```powershell
cd c:\proyectos-js\ARGO
```

### 2. Ver qué cambió

```powershell
git status
```

- **Rojo / modified**: archivos editados.
- **Untracked**: archivos nuevos que Git aún no sigue.
- Antes de `git add`, revisa que no vayas a subir basura (`.zip`, scripts locales, `.env` con secretos).

Ver resumen de líneas cambiadas:

```powershell
git diff --stat
```

Ver commits recientes (para copiar el estilo del mensaje):

```powershell
git log -5 --oneline
```

### 3. Agregar archivos al commit

**Opción recomendada — solo archivos que ya conoce Git:**

```powershell
git add -u
```

**Opción precisa — archivos concretos:**

```powershell
git add argo-backend/src/services/ejemplo.js
git add argo-frontend/src/app/features/ejemplo/
git add argo-aula-virtual/src/app/pages/home/
```

**Agregar archivo nuevo al repo (primera vez):**

```powershell
git add deploy/GUIA-GIT-DESPLIEGUE.md
```

Comprobar qué quedó en staging:

```powershell
git status
```

Los archivos en verde (staged) irán en el próximo commit.

### 4. Crear el commit

```powershell
git commit -m "Descripción clara de qué cambió y para qué"
```

Ejemplos de buenos mensajes:

- `Portal home: secciones oscuras, carreras orbitales y nuevo orden del inicio`
- `Fix: validación de documentos vencidos en RRHH`
- `Sistema: respaldos cifrados y migración dinámica`

Regla práctica: **1 commit = 1 objetivo** (un feature, un fix o un refactor acotado).

### 5. Subir a GitHub

```powershell
git push origin main
```

Si es la primera vez en una rama nueva:

```powershell
git push -u origin nombre-de-tu-rama
```

### 6. Confirmar que quedó subido

```powershell
git status
```

Debe aparecer: `Your branch is up to date with 'origin/main'`.

---

## Qué NO subir a Git

| No commitear | Motivo |
|--------------|--------|
| `deploy/.env` | Contraseñas, JWT, claves de backup, soporte maestro |
| `argo-backend/.env` | Secretos locales |
| `node_modules/` | Se instalan con `pnpm install` |
| `dist/`, `.angular/cache/` | Artefactos de compilación |
| `data/uploads/`, `data/backups/` | Datos de producción |
| `*.zip`, scripts personales sueltos | Basura local (ej. `convert_md_to_pdf.zip`) |

Si accidentalmente agregaste algo sensible:

```powershell
git restore --staged ruta/al/archivo
```

---

## Parte B — En el servidor (Linux / SSH)

Conéctate al servidor (ejemplo):

```bash
ssh root@TU_SERVIDOR
```

Ruta habitual del proyecto:

```bash
cd /opt/argo
```

### 1. Descargar cambios de GitHub

```bash
git pull origin main
```

Si pide credenciales, usa token de GitHub o SSH configurado.

### 2. Reconstruir solo lo necesario

Docker **no** detecta cambios de código solo: hay que **build** + **recreate** los contenedores afectados.

| Si cambiaste en… | Reconstruir |
|------------------|-------------|
| `argo-backend/` | `argo-backend` |
| `argo-frontend/` | `argo-frontend` |
| `argo-aula-virtual/` | `argo-aula-virtual` |
| `argo-sitio/` | `argo-sitio` |
| `docker-compose.yml`, `deploy/.env` | Los servicios que uses + revisar variables |
| Solo documentación `.md` | Nada (opcional) |

**Ejemplo — cambios en portal + backend + ERP (como el rediseño del home):**

```bash
docker compose build argo-aula-virtual argo-backend argo-frontend
docker compose up -d --force-recreate argo-aula-virtual argo-backend argo-frontend
```

**Ejemplo — solo backend:**

```bash
docker compose build argo-backend
docker compose up -d --force-recreate argo-backend
```

**Ejemplo — todo el stack (más lento, útil tras muchos cambios):**

```bash
docker compose build
docker compose up -d --force-recreate
```

### 3. Verificar contenedores

```bash
docker compose ps
```

Todos deben estar `running`.

Ver logs si algo falla:

```bash
docker compose logs -f argo-backend
docker compose logs -f argo-aula-virtual
```

(`Ctrl+C` para salir de los logs.)

### 4. Probar en el navegador

Recarga forzada: **Ctrl+F5** (evita caché del navegador).

| Servicio | Puerto por defecto (docker-compose) |
|----------|-------------------------------------|
| ERP (`argo-frontend`) | 8083 |
| Sitio público (`argo-sitio`) | 8084 |
| Aula virtual (`argo-aula-virtual`) | 8085 |
| API backend | 5002 |

---

## Comando rápido de despliegue (copiar/pegar)

Tras un `git push` desde tu PC, en el **servidor**:

```bash
cd /opt/argo
git pull origin main
docker compose build argo-aula-virtual argo-backend argo-frontend
docker compose up -d --force-recreate argo-aula-virtual argo-backend argo-frontend
docker compose ps
```

Ajusta la lista de servicios en `build` y `up` según lo que hayas tocado.

---

## Checklist antes de desplegar en producción

- [ ] `git status` limpio en PC (todo commiteado y pusheado)
- [ ] Probado en local (`pnpm start` / `pnpm run dev` según el módulo)
- [ ] No hay secretos en el commit (`git diff` revisado)
- [ ] En servidor: `git pull` sin conflictos
- [ ] `docker compose ps` — todos `running`
- [ ] Prueba manual en el navegador (login ERP, portal, API)

---

## Problemas frecuentes

### `git push` rechazado — “Updates were rejected”

Alguien subió cambios antes que tú. En PC:

```powershell
git pull origin main
# Resolver conflictos si los hay, luego:
git push origin main
```

### `git pull` en servidor — conflictos

Hay cambios locales en el servidor que chocan con GitHub. **No uses `git reset --hard` sin saber qué pierdes.** Revisa con:

```bash
git status
git diff
```

Lo habitual en producción: no editar código en el servidor; solo `git pull`.

### Cambios no se ven en el portal después del deploy

1. ¿Hiciste `docker compose build` del servicio correcto?
2. ¿Hiciste `--force-recreate`?
3. Ctrl+F5 en el navegador
4. Si usas dominio + nginx externo, puede haber caché adicional

### WARN de Docker Compose sobre variables `$`

En `deploy/.env`, los valores con `$` (hashes bcrypt antiguos) pueden corromperse. Para soporte maestro usa `SOPORTE_MASTER_PASSWORD` en texto plano. Ver [SOPORTE-MAESTRO-GUIA.md](./SOPORTE-MAESTRO-GUIA.md).

### Backend no arranca tras deploy

```bash
docker compose logs argo-backend --tail 100
```

Revisa `deploy/.env` (Mongo, JWT, etc.).

---

## Estructura del monorepo (referencia)

```
ARGO/
├── argo-backend/        → API Node.js + MongoDB
├── argo-frontend/       → ERP Angular
├── argo-aula-virtual/   → Portal / aula virtual Angular
├── argo-sitio/          → Sitio institucional estático
├── deploy/.env          → Variables de producción (NO en Git)
└── docker-compose.yml   → Orquestación Docker
```

---

## Flujo recomendado para el día a día

1. Desarrollar y probar en local.
2. `git status` → `git add` → `git commit` → `git push`.
3. SSH al servidor → `git pull` → `docker compose build …` → `docker compose up -d --force-recreate …`.
4. Verificar en navegador.

Con la práctica, los pasos 2 y 3 te toman menos de 5 minutos.

---

## Documentación relacionada

| Archivo | Contenido |
|---------|-----------|
| [GUIA-NUEVO-CLIENTE-VPS.md](./GUIA-NUEVO-CLIENTE-VPS.md) | **Nuevo cliente:** VPS, dominios, repo vs servidor, seguridad completa |
| [SOPORTE-MAESTRO-GUIA.md](./SOPORTE-MAESTRO-GUIA.md) | Cuenta break-glass de soporte |
| [GUIA-PASARELA-WOMPI.md](./GUIA-PASARELA-WOMPI.md) | Pasarela Wompi — pagos en línea matrículas virtuales |
| [SEGURIDAD-RESPALDOS-ISO27001.md](./SEGURIDAD-RESPALDOS-ISO27001.md) | Respaldos y puesta en cero |
| [../ARGO-CONTEXTO.md](../ARGO-CONTEXTO.md) | Arquitectura técnica del proyecto |

---

*Última actualización: junio 2026 — ARGO monorepo, rama `main`, despliegue Docker Compose.*
