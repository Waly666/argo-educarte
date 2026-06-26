/** Producción: rutas relativas; nginx del portal proxy /api y /uploads al backend. */
export const environment = {
  production: true,
  /** Stack Docker Educarte: activar skin completo (tema-educarte.scss) sin depender de MongoDB. */
  forceEducarteSkin: true,
  apiUrl: '/api',
  uploadsUrl: '/uploads',
  socketUrl: '',
};
