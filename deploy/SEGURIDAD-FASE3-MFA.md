# ARGO — 2FA TOTP obligatorio (ERP web)

## Alcance

| Sistema                                | 2FA                                |
| -------------------------------------- | ---------------------------------- |
| **app.finstruvial.edu.co** (ERP staff) | **Obligatorio** todos los usuarios |
| **finstruvial.edu.co** (aula alumnos)  | No                                 |
| **App móvil cajero**                   | Exenta (`X-ARGO-Cliente: cajero`)  |

## Variables `/opt/argo/deploy/.env`

```env
MFA_STAFF_REQUIRED=1
MFA_STAFF_WEB_ONLY=1
MFA_TOTP_ISSUER=ARGO Finstruvial
# Opcional (recomendado): clave dedicada para cifrar secretos TOTP
# TOTP_ENCRYPTION_KEY=generar_con_openssl_rand_hex_32
```

Desarrollo local sin 2FA:

```env
MFA_STAFF_REQUIRED=0
```

## Flujo primer login (usuario nuevo en 2FA)

1. Usuario + contraseña + Turnstile
2. Pantalla **Activar 2FA** → escanear QR con Authenticator
3. Confirmar código de 6 dígitos
4. Guardar **10 códigos de recuperación** (solo se muestran una vez)
5. Entra al ERP

## Flujo login habitual

1. Usuario + contraseña + Turnstile
2. Código 6 dígitos de Authenticator
3. Entra al ERP

## Desplegar

```bash
cd /opt/argo
git pull
docker compose build argo-backend argo-frontend
docker compose up -d --force-recreate argo-backend argo-frontend
```

## Apps Authenticator compatibles

- Google Authenticator
- Microsoft Authenticator
- Authy

## Recuperación

Si pierde el celular: en login → «Usar código de recuperación».

Si pierde todo: un admin debe resetear 2FA en BD (próxima versión: pantalla admin).

Reset manual Mongo (emergencia):

```js
db.usuarios.updateOne(
  { username: "USUARIO" },
  {
    $set: { totpEnabled: false },
    $unset: { totpSecretEnc: "", totpPendingEnc: "", mfaRecoveryHashes: "" },
  },
);
```

El usuario volverá a configurar 2FA en el próximo login web.
