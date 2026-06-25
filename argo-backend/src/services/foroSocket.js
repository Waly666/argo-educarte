const { Server } = require('socket.io');
const { verifyPortalToken } = require('./aulaVirtualAuth');
const { createCorsOptions } = require('../config/cors');
const MensajeForo = require('../models/MensajeForo');
const DatosAlumno = require('../models/DatosAlumno');
const { numDocQuery } = require('../utils/numDoc');

let ioInstance = null;

function nombreCompletoAlumno(da) {
  return [da.apellido1, da.apellido2, da.nombre1, da.nombre2].filter(Boolean).join(' ');
}

async function resolverNombreAlumno(numDoc) {
  try {
    const da = await DatosAlumno.findOne(numDocQuery(numDoc), {
      apellido1: 1, apellido2: 1, nombre1: 1, nombre2: 1,
    }).lean();
    return da ? nombreCompletoAlumno(da) : `Doc ${numDoc}`;
  } catch {
    return `Doc ${numDoc}`;
  }
}

function roomForo(idPrograma) {
  return `foro:${idPrograma}`;
}

const STAFF_ROOM = 'foro:staff';

function initForoSocket(httpServer) {
  const corsOptions = createCorsOptions();

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: corsOptions.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  const foroNs = io.of('/foro');

  foroNs.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('No autenticado'));

      let user = null;

      // Intenta como alumno portal
      try {
        const payload = verifyPortalToken(token);
        const nombre = await resolverNombreAlumno(payload.sub);
        user = {
          tipo: 'alumno',
          numDoc: Number(payload.sub),
          nombre,
        };
      } catch {
        // Intenta como usuario interno ARGO (admin/instructor)
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        user = {
          tipo: payload.tipo || 'admin',
          id: payload.sub,
          nombre: payload.nombre || payload.email || 'Staff',
        };
      }

      socket.data.user = user;
      next();
    } catch (e) {
      next(new Error('Token inválido'));
    }
  });

  foroNs.on('connection', (socket) => {
    const { user } = socket.data;

    if (user.tipo !== 'alumno') {
      socket.join(STAFF_ROOM);
    }

    const nombrePorPrograma = {};

    socket.on('join-foro', async ({ idPrograma, nombrePrograma }) => {
      if (!idPrograma) return;
      const id = String(idPrograma);
      socket.join(roomForo(id));
      if (nombrePrograma) nombrePorPrograma[id] = String(nombrePrograma);

      try {
        const mensajes = await MensajeForo.find({ idPrograma: id, eliminado: false })
          .sort({ createdAt: 1 })
          .limit(200)
          .lean();
        socket.emit('historial', mensajes);
      } catch (e) {
        socket.emit('error-foro', { message: 'Error cargando historial' });
      }
    });

    socket.on('leave-foro', ({ idPrograma }) => {
      if (idPrograma) socket.leave(roomForo(String(idPrograma)));
    });

    socket.on('enviar-mensaje', async ({ idPrograma, texto, nombrePrograma }) => {
      if (!idPrograma || !texto?.trim()) return;

      const id = String(idPrograma);
      const textoLimpio = String(texto).trim().slice(0, 2000);
      const nomProg = nombrePrograma || nombrePorPrograma[id] || '';

      try {
        const msg = await MensajeForo.create({
          idPrograma: id,
          nombrePrograma: nomProg,
          autorNumDoc: user.tipo === 'alumno' ? user.numDoc : null,
          autorId: user.tipo !== 'alumno' ? user.id : null,
          autorNombre: user.nombre,
          autorTipo: user.tipo === 'admin' ? 'admin' : user.tipo === 'instructor' ? 'instructor' : 'alumno',
          texto: textoLimpio,
        });

        foroNs.to(roomForo(id)).emit('nuevo-mensaje', msg.toObject());

        if (user.tipo === 'alumno') {
          foroNs.to(STAFF_ROOM).emit('foro-nuevo-mensaje', {
            _id: String(msg._id),
            idPrograma: id,
            nombrePrograma: nomProg || msg.nombrePrograma || id,
            autorNombre: user.nombre,
            texto: textoLimpio,
            createdAt: msg.createdAt,
          });
        }
      } catch (e) {
        console.error('[Foro] Error guardando mensaje:', e.message);
        socket.emit('error-foro', { message: 'Error enviando mensaje' });
      }
    });

    socket.on('eliminar-mensaje', async ({ idPrograma, mensajeId }) => {
      if (user.tipo === 'alumno') return;
      try {
        await MensajeForo.findByIdAndUpdate(mensajeId, { eliminado: true });
        foroNs.to(roomForo(idPrograma)).emit('mensaje-eliminado', { _id: mensajeId });
      } catch {
        // silent
      }
    });
  });

  return io;
}

module.exports = { initForoSocket };
