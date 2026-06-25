# ARGO Mobile Cajero / Admin

App Android (APK) para cajero y administrador: caja, alumnos, facturación, programas y servicios.

## Stack

- Expo 54 + React Native + TypeScript
- React Navigation 7
- API REST ARGO (`/api/auth/login`, `/api/config/alertas`, caja, comprobantes, certificados)
- Alertas con sonido propio (`assets/sounds/argo-alerta.wav`) y vibración
- Accesibilidad: modo estándar y modo visión asistida (texto/botones/alertas ampliados)

## Requisitos

- Node 22+
- pnpm
- Backend ARGO en marcha

## Desarrollo

```bash
cd argo-mobile-cajero   # usar minúsculas (Windows + Metro)
pnpm install
cp .env.example .env
# Editar EXPO_PUBLIC_API_BASE_URL=http://TU_IP:3000/api
pnpm start
```

**Importante (Windows):** entre al folder con el nombre en minúsculas `argo-mobile-cajero`. Si usas `ARGO-MOBILE-CAJERO` en mayúsculas, Metro puede fallar con "Something went wrong".

En celular físico: misma Wi‑Fi que el PC, IP local en Login → Servidor API.

## APK

```bash
pnpm run build:apk
```

Requiere cuenta Expo y `eas login`.

## Configuración

- **Roles y alertas globales:** solo en la app web ARGO
- **Lectura y sonido:** pantalla «Lectura y alertas» en la app móvil

## Módulos

| Módulo | Estado |
|--------|--------|
| Login, alertas, accesibilidad | ✅ Base lista |
| Caja, alumnos, facturación, programas, servicios | 🔜 Conectar pantallas al API |
