# ARGO — Seguridad Fase 2

Complementa [SEGURIDAD-FASE1.md](./SEGURIDAD-FASE1.md).

## Implementado en código

| Medida | Detalle |
|--------|---------|
| **Turnstile ERP** | Login en `app.finstruvial.edu.co` con mismo widget Cloudflare |
| **Móvil sin captcha** | App cajero envía `X-ARGO-Cliente: cajero` → sin Turnstile |
| **Auditoría login** | Intentos fallidos en `logs/auth/` + colección auditoría |
| **Cabeceras nginx** | Snippet `deploy/nginx/snippets/argo-security-headers.conf` |
| **Script firewall** | `deploy/setup-firewall-argo.sh` |

## 1. Turnstile en ERP

En Cloudflare Turnstile → **Hostnames** debe incluir:

```
finstruvial.edu.co
www.finstruvial.edu.co
app.finstruvial.edu.co
```

Mismas claves en `/opt/argo/deploy/.env` (ya configuradas en Fase 1).

## 2. Desplegar en VPS

```bash
cd /opt/argo
git pull
docker compose build argo-backend argo-frontend argo-aula-virtual
docker compose up -d --force-recreate argo-backend argo-frontend argo-aula-virtual
```

Probar:

- https://app.finstruvial.edu.co/login → widget Turnstile + login
- https://finstruvial.edu.co/login → sigue con Turnstile
- App móvil cajero → login sin captcha (header `X-ARGO-Cliente`)

## 3. Firewall (cerrar puertos Docker)

```bash
chmod +x deploy/setup-firewall-argo.sh
./deploy/setup-firewall-argo.sh
```

Cierra `5002`, `8083`, `8085` al exterior. Solo `80` y `443` públicos.

**Importante:** no cierres el puerto `22` (SSH).

## 4. Cabeceras nginx (opcional)

En cada sitio ARGO (`/etc/nginx/sites-available/finstruvial.edu.co` y `app.finstruvial.edu.co`), dentro del bloque `server { }`:

```nginx
include /opt/argo/deploy/nginx/snippets/argo-security-headers.conf;
```

```bash
nginx -t && systemctl reload nginx
```

## 5. Cloudflare delante del VPS (recomendado)

Si el dominio **no** usa nameservers de Cloudflare, puedes igual usar Turnstile (ya activo).

Para **WAF + proxy + DDoS**:

1. En Hostinger (o tu DNS): no cambies los registros A actuales si no migras DNS completo.
2. **Opción A — DNS en Cloudflare (máxima protección):**
   - Añade `finstruvial.edu.co` en Cloudflare → Add site
   - Cambia nameservers en Hostinger a los de Cloudflare
   - Registros A → `72.60.175.120` (proxied naranja ☁️)
   - SSL/TLS → **Full (strict)**
   - Security → WAF → reglas básicas activadas
3. **Opción B — Solo Turnstile (actual):** sin proxy; el tráfico va directo al VPS.

Con proxy Cloudflare activo, en VPS:

```env
TRUST_PROXY=1
```

(ya configurado)

## 6. Revisar intentos fallidos

En el VPS:

```bash
tail -f /opt/argo/argo-backend/logs/auth/auth-$(date +%Y-%m-%d).log
# o dentro del contenedor:
docker compose exec argo-backend tail -20 logs/auth/auth-$(date +%Y-%m-%d).log
```

En ERP: menú **Auditoría** → buscar acción `login_fallido`.

## Fase 3 (futuro)

- 2FA para administradores
- Alertas por email en múltiples fallos de login
- Rotación automática JWT / sesiones
