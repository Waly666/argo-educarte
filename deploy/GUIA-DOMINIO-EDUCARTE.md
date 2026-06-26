# Educarte — dominio + HTTPS + seguridad

Dominios:

| Servicio | Dominio | Docker interno |
|----------|---------|------------------|
| Aula virtual | `https://educartecolombia.com` | `:8085` |
| ERP staff | `https://app.educartecolombia.com` | `:8083` |

VPS: `2.25.199.98` · stack: `docker-compose.educarte.yml`

---

## 1. DNS en Hostinger

Zona DNS del dominio `educartecolombia.com`:

| Tipo | Nombre | Contenido | TTL |
|------|--------|-----------|-----|
| A | `@` | `2.25.199.98` | 300 |
| A | `www` | `2.25.199.98` | 300 |
| A | `app` | `2.25.199.98` | 300 |

Esperar propagación (15–60 min). Comprobar:

```bash
dig +short educartecolombia.com A
dig +short app.educartecolombia.com A
```

Firewall Hostinger: permitir **22**, **80**, **443**.

### Si `dig` muestra IPs 104.x / 172.x (Cloudflare)

El dominio usa **proxy Cloudflare** (nube naranja). Es normal que no vea `2.25.199.98` en `dig`.

En **Cloudflare → DNS**, confirme que `@`, `www` y `app` apuntan a **`2.25.199.98`** (con proxy activado).

**SSL/TLS → Overview:** use **Full** al emitir el certificado; luego **Full (strict)**.

En el VPS use:

```bash
sudo CLOUDFLARE_PROXY=1 ./deploy/setup-educarte-dominio.sh
```

---

## 2. nginx + SSL en el VPS

```bash
cd /opt/argo-educarte
git pull origin main
chmod +x deploy/*.sh
sudo ./deploy/setup-educarte-dominio.sh
# Con Cloudflare proxied:
# sudo CLOUDFLARE_PROXY=1 ./deploy/setup-educarte-dominio.sh
```

El script:

- Verifica que DNS apunta al VPS
- Instala configs `deploy/nginx/educartecolombia.com.conf` y `app.educartecolombia.com.conf`
- Emite certificados Let's Encrypt con Certbot
- Actualiza `CORS_ORIGIN` y `PORTAL_SITE_URL` en `deploy/.env`
- Recrea `argo-backend`

Probar:

- https://educartecolombia.com
- https://app.educartecolombia.com/login
- https://app.educartecolombia.com/api/health

---

## 3. Cerrar puertos IP (después de HTTPS)

Solo cuando los dominios HTTPS funcionen:

```bash
sudo ./deploy/setup-firewall-argo.sh
```

Cierra `8083`, `8085`, `5002` al exterior. El acceso público queda solo por `:443`.

---

## 4. Seguridad adicional (orden)

Ver [ARGO-STACK-SEGURIDAD-ISO.md](../ARGO-STACK-SEGURIDAD-ISO.md):

1. `BACKUP_CLAVE_CIFRADO` + copia automática (ERP → Sistema)
2. Cloudflare Turnstile — [SEGURIDAD-FASE1.md](./SEGURIDAD-FASE1.md)
3. `MFA_STAFF_REQUIRED=1` — [SEGURIDAD-FASE3-MFA.md](./SEGURIDAD-FASE3-MFA.md)

Turnstile hostnames: `educartecolombia.com`, `www.educartecolombia.com`, `app.educartecolombia.com`.

---

## 5. Portal aún dice Finstruvial

Eso es **configuración en MongoDB**, no nginx. En el ERP:

- Aula virtual → Editor sitio portal → plantilla Educarte → Publicar cambios
- Aula virtual → Empresa → logo y datos

---

## 6. App móvil

Tras dominio:

```env
EXPO_PUBLIC_API_BASE_URL=https://app.educartecolombia.com/api
```

Regenerar APK y subir por el ERP.
