# Despliegue Educarte en VPS — fase 1 por IP, fase 2 dominio

Guía para desplegar **backend**, **ERP** y **portal aula virtual** con Docker antes de configurar dominio y SSL.

---

## Resumen

| Servicio | URL (fase IP) | Puerto |
|----------|---------------|--------|
| ERP (frontend) | `http://TU_IP:8083` | 8083 |
| Aula virtual | `http://TU_IP:8085` | 8085 |
| API (directa / móvil) | `http://TU_IP:5002/api` | 5002 |

Stack Docker: `docker-compose.educarte.yml` (MongoDB + backend + ERP + portal). **No incluye** sitio marketing (`argo-sitio`).

---

## Requisitos en el VPS

- Ubuntu 22.04+ (o similar)
- Docker Engine + Docker Compose v2
- Git
- Puertos **8083**, **8085** y **5002** abiertos (firewall / panel del proveedor)
- Mínimo **2 GB RAM** (4 GB recomendado para build)

Instalar Docker (si falta):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Cerrar sesión SSH y volver a entrar
```

---

## Paso 1 — Clonar el repo

```bash
sudo mkdir -p /opt/argo-educarte
sudo chown "$USER:$USER" /opt/argo-educarte
cd /opt/argo-educarte
git clone https://github.com/Waly666/argo-educarte.git .
```

---

## Paso 2 — Variables de entorno (IP)

Sustituya `TU_IP` por la IP pública del VPS:

```bash
chmod +x deploy/*.sh
./deploy/setup-educarte-ip-env.sh TU_IP
```

Esto crea `deploy/.env` con:

- `JWT_SECRET` aleatorio
- `CORS_ORIGIN` para `:8083` y `:8085`
- `MONGO_URI=mongodb://argo-mongo:27017/argo-educarte`
- `MFA_STAFF_REQUIRED=0` (facilita el primer acceso al ERP)

---

## Paso 3 — Build y arranque

```bash
./deploy/deploy-educarte-ip.sh
```

Primera vez puede tardar **15–30 min** (build Angular + npm).

Comprobar:

```bash
curl -s http://127.0.0.1:5002/api/health
docker compose -f docker-compose.educarte.yml ps
```

Desde su PC: abrir `http://TU_IP:8083` (ERP) y `http://TU_IP:8085` (aula).

---

## Paso 4 — Firewall (opcional)

```bash
sudo ./deploy/setup-firewall-educarte-ip.sh
```

**No ejecute** `setup-firewall-argo.sh` en fase IP: bloquea los puertos 8083/8085.

---

## Paso 5 — Datos iniciales

1. **ERP** → crear usuario administrador (primer arranque / seed según su BD).
2. **Aula virtual** → configurar logo, hero, textos (ERP → Aula virtual → Sitio).
3. **APK móvil** → ERP → Aula virtual → App móvil (subir APK). El archivo queda en el backend; opcionalmente copie a `./apk/` en el VPS para descarga estática en `:8085/apk/`.

Carpetas persistentes en el host:

```
data/uploads/   → logos, hero, documentos
data/backups/   → copias ERP
apk/            → APK opcional para nginx del portal
```

---

## Actualizar después de cambios en GitHub

```bash
cd /opt/argo-educarte
git pull
./deploy/deploy-educarte-ip.sh
```

---

## Fase 2 — Dominio y HTTPS (cuando la IP funcione)

1. Apunte DNS al VPS (`app.educarte.edu.co`, `aula.educarte.edu.co` o los que use).
2. Copie/adapte configs en `deploy/nginx/` (plantillas Finstruvial como referencia).
3. `./deploy/setup-nginx-ssl.sh` + Certbot.
4. Actualice `deploy/.env`:

   ```env
   PUBLIC_URL=
   PORTAL_SITE_URL=https://aula.educarte.edu.co
   CORS_ORIGIN=https://app.educarte.edu.co,https://aula.educarte.edu.co
   MFA_STAFF_REQUIRED=1
   ```

5. `docker compose -f docker-compose.educarte.yml up -d --force-recreate argo-backend`
6. Cierre puertos 8083/8085/5002 al público; solo 80/443 vía nginx.

---

## Comandos útiles

```bash
# Logs backend
docker compose -f docker-compose.educarte.yml logs -f argo-backend

# Reiniciar solo API
docker compose -f docker-compose.educarte.yml restart argo-backend

# Mongo shell
docker exec -it argo-educarte-mongo mongosh argo-educarte

# Restaurar backup
./deploy/restore-mongo.sh ruta/al/dump
```

---

## App móvil (APK)

En `eas.json` use la URL del VPS:

```env
EXPO_PUBLIC_API_BASE_URL=http://TU_IP:5002/api
```

O, si prefiere pasar por el ERP nginx:

```env
EXPO_PUBLIC_API_BASE_URL=http://TU_IP:8083/api
```

Regenere APK con `pnpm run build:apk` en `argo-mobile-aula` y súbalo por el ERP.

---

## Solución de problemas

| Síntoma | Revisar |
|---------|---------|
| CORS en navegador | `CORS_ORIGIN` en `deploy/.env` debe incluir `http://TU_IP:8083` y `:8085` |
| 502 en ERP/aula | `docker compose ... logs argo-backend` — Mongo arriba |
| Uploads rotos | `data/uploads` montado; permisos escritura |
| Build sin RAM | Build por servicio: ver `deploy/build-sequential.sh` adaptando `-f docker-compose.educarte.yml` |
