# ARGO — Seguridad Fase 1 (producción)

## Ya aplicado en código

| Medida | Qué hace |
|--------|----------|
| **HTTPS** | nginx + Certbot en `finstruvial.edu.co` y `app.finstruvial.edu.co` |
| **Helmet** | Cabeceras HTTP seguras en el backend |
| **Rate limit** | Login staff, login/registro portal, `buscar-alumno` |
| **Turnstile** | Captcha en login/registro/consulta documento (portal) |
| **Registro on/off** | `PORTAL_REGISTRO_ABIERTO=0` cierra registro público |
| **buscar-alumno** | No expone celular, dirección ni correo completo |

## Variables en `/opt/argo/deploy/.env`

```env
TRUST_PROXY=1
PORTAL_REGISTRO_ABIERTO=1

# Límites por IP (ventana 15 min)
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_BUSCAR_ALUMNO_MAX=15

# Turnstile — crear en Cloudflare → Turnstile → Add site
TURNSTILE_SITE_KEY=tu_site_key
TURNSTILE_SECRET_KEY=tu_secret_key
TURNSTILE_ENABLED=1
```

Dominios permitidos en Turnstile: `finstruvial.edu.co`, `app.finstruvial.edu.co`.

Si **no** configuras Turnstile, login y registro funcionan sin captcha (solo rate limit).

## Desplegar en VPS

```bash
cd /opt/argo
git pull
./deploy/build-sequential.sh
# o solo backend + aula:
docker compose build argo-backend argo-aula-virtual
docker compose up -d --force-recreate argo-backend argo-aula-virtual
```

Cerrar puertos al exterior (solo 80/443):

```bash
ufw deny 5002/tcp
ufw deny 8083/tcp
ufw deny 8085/tcp
```

## Cerrar registro temporalmente

```env
PORTAL_REGISTRO_ABIERTO=0
```

```bash
docker compose up -d --force-recreate argo-backend
```

## Fase 2

Ver [SEGURIDAD-FASE2.md](./SEGURIDAD-FASE2.md): Turnstile ERP, firewall, auditoría login, Cloudflare proxy.
