# ARGO — Despliegue en VPS nuevo (nuevo cliente)

Guía para instalar ARGO en un **servidor nuevo** cuando vendes el producto a otro cliente (CEA, centro de formación, etc.).

> **Resumen:** normalmente **NO** necesitas un repositorio Git por cliente. Usas **un solo repo del producto** y **un VPS (o stack Docker) por cliente**, con datos, dominios y secretos independientes.

---

## 1. ¿Un repo por cliente o uno solo?

| Modelo | Cuándo usarlo | Ventajas | Desventajas |
|--------|---------------|----------|-------------|
| **A — Un repo, N servidores (recomendado)** | Clientes usan el mismo producto ARGO | Un solo código; actualizaciones con `git pull` en cada VPS | Cada cliente debe desplegarse por separado |
| **B — Rama por cliente** (`cliente-acme`) | Ajustes menores por cliente en el mismo repo | Historial unificado | Más trabajo al mezclar mejoras del producto |
| **C — Repo/fork por cliente** | White-label fuerte o código muy distinto | Aislamiento total del código | Duplicas mantenimiento; difícil escalar |

### Recomendación para vender ARGO

1. Mantén **un repositorio privado del producto** (ej. `Waly666/ARGO` en GitHub).
2. Por cada cliente nuevo: **VPS nuevo** + **dominios del cliente** + **`deploy/.env` único**.
3. La **base de datos MongoDB** vive solo en ese VPS (volumen Docker `argo_mongo_data`).
4. Los **archivos** (uploads, respaldos) van en `./data/` de ese servidor, no en Git.
5. Crea repo/rama aparte **solo si** ese cliente paga desarrollo exclusivo que no debe ir al producto base.

**No copies el repo solo para “tenerlo separado”.** La separación real es: servidor + `.env` + dominio + datos.

---

## 2. Qué lleva cada cliente (checklist de aislamiento)

| Elemento | ¿Compartido entre clientes? | Dónde vive |
|----------|----------------------------|------------|
| Código fuente (Git) | Sí — mismo repo producto | GitHub |
| `deploy/.env` | **No** — único por VPS | Solo en el servidor |
| `JWT_SECRET` | **No** | `deploy/.env` |
| `BACKUP_CLAVE_CIFRADO` | **No** | `deploy/.env` + gestor de contraseñas |
| Cuenta soporte maestro | **No** | `deploy/.env` + Authenticator |
| MongoDB | **No** | Volumen Docker del VPS |
| `data/uploads/`, `data/backups/` | **No** | Disco del VPS |
| Dominios (ERP + portal) | **No** | DNS del cliente |
| Turnstile / Wompi / SMTP | **No** (claves por dominio/cuenta) | `deploy/.env` + paneles externos |
| Usuarios ERP y alumnos | **No** | Base de datos del cliente |

---

## 3. Requisitos antes de empezar

### 3.1 Servidor (VPS)

| Recurso | Mínimo recomendado | Notas |
|---------|-------------------|--------|
| RAM | **4 GB** | Builds Docker; usar `./deploy/build-sequential.sh` si hay poca RAM |
| Disco | **40 GB+** | BD, uploads, respaldos |
| SO | Ubuntu 22.04 / 24.04 LTS | |
| Acceso | SSH (root o sudo) | |

### 3.2 Dominios (ejemplo cliente “Acme CEA”)

Sustituye por los dominios reales del cliente:

| Rol | Ejemplo | Apunta a |
|-----|---------|----------|
| Portal / aula virtual | `acme.edu.co`, `www.acme.edu.co` | IP del VPS |
| ERP staff + API | `app.acme.edu.co` | IP del VPS |

Registros DNS tipo **A** (IPv4) hacia la IP pública del VPS. Espera propagación (minutos a horas).

### 3.3 Herramientas en el VPS

```bash
apt update && apt install -y git curl ufw nginx certbot python3-certbot-nginx
```

Instalar Docker y Docker Compose v2 (plugin oficial de Docker).

### 3.4 Acceso a GitHub

En el VPS, clona con SSH o token de solo lectura al repo privado:

```bash
mkdir -p /opt/argo
cd /opt/argo
git clone https://github.com/TU_ORG/ARGO.git .
# o: git clone git@github.com:TU_ORG/ARGO.git .
```

---

## 4. Instalación paso a paso (primer despliegue)

### Paso 1 — Clonar el proyecto

```bash
cd /opt/argo
git checkout main
git pull origin main
```

### Paso 2 — Crear `deploy/.env` del cliente

```bash
cp deploy/env.example deploy/.env
nano deploy/.env
```

**Variables obligatorias a personalizar** (nunca reutilizar las de otro cliente):

```env
# Secreto de sesión — generar nuevo:
# openssl rand -hex 32
JWT_SECRET=CAMBIAR_GENERAR_NUEVO_64_CHARS_HEX
JWT_EXPIRES=12h

MONGO_URI=mongodb://argo-mongo:27017/argo
NODE_ENV=production
TZ=America/Bogota
TRUST_PROXY=1

# Dominios del CLIENTE (ejemplo Acme):
CORS_ORIGIN=https://app.acme.edu.co,https://acme.edu.co,https://www.acme.edu.co
PORTAL_SITE_URL=https://acme.edu.co
PUBLIC_URL=

# Portal
PORTAL_REGISTRO_ABIERTO=1

# 2FA obligatorio en ERP (recomendado producción)
MFA_STAFF_REQUIRED=1
MFA_STAFF_WEB_ONLY=1
MFA_TOTP_ISSUER=ARGO Acme

# Respaldos cifrados (OBLIGATORIO en producción comercial)
BACKUP_CLAVE_CIFRADO=frase_larga_unica_guardar_fuera_del_servidor

# Rate limits
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_BUSCAR_ALUMNO_MAX=15
```

Opcional según el cliente: Turnstile, SMTP, Wompi, Factus — ver sección 7.

Crear carpetas de datos:

```bash
mkdir -p data/uploads data/backups data/sitio-videos apk
```

### Paso 3 — Levantar el stack Docker

Build (VPS con poca RAM):

```bash
chmod +x deploy/build-sequential.sh
./deploy/build-sequential.sh
```

O build completo:

```bash
docker compose build
docker compose up -d
docker compose ps
```

Verificar API:

```bash
curl -sf http://127.0.0.1:5002/api/health && echo OK
```

### Paso 4 — Nginx + HTTPS (Let's Encrypt)

1. Copia las plantillas nginx y **cambia los `server_name`** por los dominios del cliente:

```bash
cp deploy/nginx/finstruvial.edu.co.conf /etc/nginx/sites-available/portal-cliente.conf
cp deploy/nginx/app.finstruvial.edu.co.conf /etc/nginx/sites-available/app-cliente.conf
nano /etc/nginx/sites-available/portal-cliente.conf   # server_name acme.edu.co www.acme.edu.co
nano /etc/nginx/sites-available/app-cliente.conf      # server_name app.acme.edu.co
```

2. Incluir cabeceras de seguridad en cada bloque `server { }`:

```nginx
include /opt/argo/deploy/nginx/snippets/argo-security-headers.conf;
```

3. Activar sitios y probar:

```bash
ln -sf /etc/nginx/sites-available/portal-cliente.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/app-cliente.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

4. Certificados SSL:

```bash
certbot --nginx -d acme.edu.co -d www.acme.edu.co -d app.acme.edu.co
```

5. Reiniciar backend tras ajustar CORS:

```bash
docker compose up -d --force-recreate argo-backend
```

Pruebas:

```bash
curl -sfI https://app.acme.edu.co/ | head -1
curl -sf https://app.acme.edu.co/api/health && echo
```

> Plantilla automatizada para el primer cliente Finstruvial: `./deploy/setup-nginx-ssl.sh` (adaptar dominios antes de usar en otro cliente).

### Paso 5 — Firewall

```bash
chmod +x deploy/setup-firewall-argo.sh
./deploy/setup-firewall-argo.sh
```

Deja públicos solo **22** (SSH), **80** y **443**. Bloquea **5002**, **8083**, **8084**, **8085** hacia Internet.

### Paso 6 — Configuración inicial en el ERP

1. Abrir `https://app.acme.edu.co`
2. Crear **primer usuario administrador** (si la instalación está vacía) o usar migración.
3. **Configuración → Empresa** — nombre, NIT, logo, datos legales.
4. **Configuración → Sedes** — sede principal.
5. **Configuración → Comprobantes de caja** — prefijos, formato media carta/validadora.
6. **Configuración → Roles y usuarios** — personal del cliente.
7. **Configuración → Certificados / Nómina / Facturación** — según contrato.

Si el cliente trae datos históricos: **Sistema → Migración de datos** (Excel) o ver [MIGRACION-DESDE-ACCESS.md](./MIGRACION-DESDE-ACCESS.md).

---

## 5. Seguridad incluida en ARGO (activar en cada VPS)

ARGO incluye varias capas. En **cada cliente nuevo** debes configurarlas en `deploy/.env` y nginx.

### 5.1 HTTPS y proxy

| Medida | Descripción |
|--------|-------------|
| **Let's Encrypt** | Certificados TLS en nginx |
| **TRUST_PROXY=1** | Backend respeta `X-Forwarded-Proto` detrás de nginx |
| **CORS_ORIGIN** | Solo dominios del cliente |

### 5.2 Cabeceras HTTP (Helmet + nginx)

| Capa | Qué hace |
|------|----------|
| **Helmet** (backend) | Cabeceras seguras en respuestas API |
| **nginx snippet** | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |

Archivo: `deploy/nginx/snippets/argo-security-headers.conf`

### 5.3 Rate limiting

Limita intentos por IP (ventana 15 min):

- Login staff (ERP)
- Login/registro portal alumnos
- Consulta `buscar-alumno`

Variables: `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_BUSCAR_ALUMNO_MAX`

Detalle: [SEGURIDAD-FASE1.md](./SEGURIDAD-FASE1.md)

### 5.4 Cloudflare Turnstile (captcha)

Protege login y registro contra bots.

1. Crear sitio en [Cloudflare Turnstile](https://dash.cloudflare.com/)
2. Hostnames: dominios del **cliente** (`acme.edu.co`, `app.acme.edu.co`)
3. En `deploy/.env`:

```env
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
TURNSTILE_ENABLED=1
```

4. Rebuild: `docker compose up -d --force-recreate argo-backend argo-frontend argo-aula-virtual`

La app móvil cajero **no** usa captcha (header `X-ARGO-Cliente: cajero`).

Detalle: [SEGURIDAD-FASE1.md](./SEGURIDAD-FASE1.md), [SEGURIDAD-FASE2.md](./SEGURIDAD-FASE2.md)

### 5.5 2FA TOTP (obligatorio ERP web)

Todos los usuarios staff en `app.dominio-cliente` deben activar Authenticator.

```env
MFA_STAFF_REQUIRED=1
MFA_STAFF_WEB_ONLY=1
MFA_TOTP_ISSUER=ARGO NombreCliente
# TOTP_ENCRYPTION_KEY=opcional openssl rand -hex 32
```

Detalle: [SEGURIDAD-FASE3-MFA.md](./SEGURIDAD-FASE3-MFA.md)

### 5.6 Auditoría de accesos

- Intentos de login fallidos → `logs/auth/` + colección `auditoria`
- Acciones sensibles → menú **Configuración → Auditoría**
- Reautenticación (contraseña + TOTP) para restaurar respaldo o puesta en cero

### 5.7 Privacidad en portal

- `buscar-alumno` no expone celular, dirección ni correo completo
- `PORTAL_REGISTRO_ABIERTO=0` cierra registro público temporalmente

### 5.8 Respaldos cifrados (ISO 27001)

Módulo **Sistema → Copias de seguridad**:

- Copia manual y automática diaria
- Cifrado AES-256-GCM con `BACKUP_CLAVE_CIFRADO`
- Restauración y puesta en cero auditadas

**Guardar la clave de cifrado fuera del VPS** (gestor de contraseñas del cliente o tuyo como proveedor).

Detalle: [SEGURIDAD-RESPALDOS-ISO27001.md](./SEGURIDAD-RESPALDOS-ISO27001.md)

### 5.9 Cuenta soporte maestro (break-glass del proveedor)

Para que **tú** (proveedor) entres a dar soporte sin mezclar cuentas del cliente:

- Credenciales **solo en `deploy/.env`**, no en la base de datos
- **2FA obligatorio**, distinto por cada VPS
- Todo queda en auditoría

Detalle: [SOPORTE-MAESTRO-GUIA.md](./SOPORTE-MAESTRO-GUIA.md)

### 5.10 Cloudflare proxy (opcional, recomendado)

Delante del VPS: WAF, anti-DDoS, ocultar IP. Requiere nameservers en Cloudflare y SSL **Full (strict)**.

Detalle: [SEGURIDAD-FASE2.md](./SEGURIDAD-FASE2.md)

### 5.11 Checklist seguridad — nuevo cliente

- [ ] `JWT_SECRET` nuevo (único)
- [ ] `BACKUP_CLAVE_CIFRADO` definida y guardada fuera del servidor
- [ ] HTTPS activo en todos los dominios
- [ ] `CORS_ORIGIN` solo dominios del cliente
- [ ] Firewall: solo 22, 80, 443 públicos
- [ ] Turnstile configurado (o documentado por qué no)
- [ ] MFA staff activo (`MFA_STAFF_REQUIRED=1`)
- [ ] Soporte maestro generado (si aplica contrato de soporte)
- [ ] Copia automática programada en Sistema
- [ ] Prueba de login ERP + portal + health API

---

## 6. Servicios Docker por cliente

| Contenedor | Puerto interno host | Uso |
|------------|---------------------|-----|
| `argo-mongo` | (solo red Docker) | Base de datos |
| `argo-backend` | 5002 → API | Node.js |
| `argo-frontend` | 8083 → ERP Angular | Staff |
| `argo-sitio` | 8084 → sitio marketing | Opcional |
| `argo-aula-virtual` | 8085 → portal alumnos | Matrículas virtuales |

En producción el usuario **solo** entra por **443** (nginx); los puertos 808x y 5002 quedan en localhost.

---

## 7. Integraciones opcionales por cliente

| Integración | Documento | Notas |
|-------------|-----------|-------|
| Pasarela Wompi | [GUIA-PASARELA-WOMPI.md](./GUIA-PASARELA-WOMPI.md) | Claves sandbox/producción por comercio |
| Facturación electrónica Factus | `deploy/factus-sandbox.env.example` | Variables en `deploy/.env` |
| Correo registro portal | `deploy/env.example` (SMTP_*) | Verificación email alumnos |

---

## 8. Actualizar un cliente (después del primer deploy)

En **tu PC**: desarrollas → `git commit` → `git push`.

En **el VPS del cliente**:

```bash
cd /opt/argo
git pull origin main
docker compose build argo-backend argo-frontend   # ajusta servicios tocados
docker compose up -d --force-recreate argo-backend argo-frontend
docker compose ps
```

**Importante:** si `docker compose build argo-frontend` falla, el contenedor sigue con la imagen vieja. Revisa que el build termine sin errores.

Guía detallada: [GUIA-GIT-DESPLIEGUE.md](./GUIA-GIT-DESPLIEGUE.md)

---

## 9. Reutilizar un VPS para otro cliente

**No recomendado** en producción sin proceso formal.

Si debes hacerlo:

1. Descargar y archivar último respaldo del cliente anterior (cifrado).
2. ERP → **Sistema → Puesta en cero** (copia previa automática + auditoría).
3. Cambiar `deploy/.env` (nuevo `JWT_SECRET`, claves, CORS, dominios).
4. Reconfigurar nginx + certbot para nuevos dominios.
5. Configurar empresa, sedes y usuarios del cliente nuevo.

---

## 10. Modelo comercial sugerido (proveedor → cliente)

| Entregable | Descripción |
|------------|-------------|
| VPS dedicado | Un servidor por cliente o contenedor aislado |
| Dominio | A nombre del cliente |
| Instalación inicial | Esta guía + configuración base |
| Capacitación | Admin ERP, caja, RRHH según módulos contratados |
| Soporte | Cuenta break-glass + SLA acordado |
| Respaldos | Automáticos + custodia (cliente o proveedor) |
| Actualizaciones | `git pull` + rebuild programado |

**No entregues** el archivo `deploy/.env` al cliente en texto plano por email. Usa gestor de contraseñas o documento cifrado.

---

## 11. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Cambios no se ven tras deploy | Build falló o no se hizo `--force-recreate` | `docker compose build --no-cache argo-frontend` y revisar logs |
| CORS error en navegador | `CORS_ORIGIN` no incluye el dominio | Editar `deploy/.env` y recrear backend |
| API 502 | Backend caído o nginx mal configurado | `docker compose logs argo-backend --tail 50` |
| Certificado SSL falla | DNS no apunta al VPS | Verificar registro A |
| Login sin Turnstile | Claves vacías o dominio no en Cloudflare | Revisar `TURNSTILE_*` |
| No puedo restaurar respaldo | Falta `BACKUP_CLAVE_CIFRADO` original | Usar la clave del momento del backup |

---

## 12. Documentación relacionada

| Archivo | Contenido |
|---------|-----------|
| [GUIA-GIT-DESPLIEGUE.md](./GUIA-GIT-DESPLIEGUE.md) | Commit, push y deploy día a día |
| [SEGURIDAD-FASE1.md](./SEGURIDAD-FASE1.md) | HTTPS, rate limit, Turnstile portal |
| [SEGURIDAD-FASE2.md](./SEGURIDAD-FASE2.md) | Turnstile ERP, firewall, Cloudflare |
| [SEGURIDAD-FASE3-MFA.md](./SEGURIDAD-FASE3-MFA.md) | 2FA TOTP staff |
| [SEGURIDAD-RESPALDOS-ISO27001.md](./SEGURIDAD-RESPALDOS-ISO27001.md) | Respaldos, reset, migración |
| [SOPORTE-MAESTRO-GUIA.md](./SOPORTE-MAESTRO-GUIA.md) | Acceso proveedor break-glass |
| [GUIA-PASARELA-WOMPI.md](./GUIA-PASARELA-WOMPI.md) | Pagos en línea |
| [../ARGO-CONTEXTO.md](../ARGO-CONTEXTO.md) | Arquitectura técnica del producto |

---

## 13. Resumen ejecutivo (para el cliente nuevo)

1. Contratas VPS + dominios (`app.cliente.com` + portal).
2. Clonas el **mismo repo ARGO** en `/opt/argo`.
3. Creas **`deploy/.env` único** con secretos nuevos.
4. `docker compose up` + nginx + SSL + firewall.
5. Configuras empresa, sedes, usuarios y respaldos en el ERP.
6. Activas Turnstile, 2FA y respaldos cifrados.
7. Futuras mejoras del producto → `git pull` en ese VPS.

**No necesitas subir todo a un repositorio nuevo por cliente** salvo que vendas un fork personalizado permanente.

---

*Última actualización: junio 2026 — ARGO monorepo, despliegue Docker Compose por cliente.*
