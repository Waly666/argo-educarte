import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { fetchForoMensajes } from '../api/aulaApi';
import type { MensajeForo } from '../api/types';
import { getSocketBaseUrl } from '../config/apiBase';

type UseForoOpts = {
  token: string | null;
  idPrograma: string | null;
  nombrePrograma?: string;
};

export function useForo({ token, idPrograma, nombrePrograma = '' }: UseForoOpts) {
  const [mensajes, setMensajes] = useState<MensajeForo[]>([]);
  const [conectado, setConectado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const programaRef = useRef<string | null>(null);
  const nombreRef = useRef(nombrePrograma);

  useEffect(() => {
    nombreRef.current = nombrePrograma;
  }, [nombrePrograma]);

  const ensureSocket = useCallback(() => {
    if (!token) return null;
    if (!socketRef.current) {
      const socket = io(`${getSocketBaseUrl()}/foro`, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        autoConnect: true,
      });
      socket.on('connect', () => {
        setConectado(true);
        setError(null);
      });
      socket.on('disconnect', () => setConectado(false));
      socket.on('historial', (msgs: MensajeForo[]) => {
        setMensajes(Array.isArray(msgs) ? msgs : []);
        setCargando(false);
      });
      socket.on('nuevo-mensaje', (msg: MensajeForo) => {
        if (String(msg.idPrograma) !== String(programaRef.current)) return;
        setMensajes((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
      });
      socket.on('mensaje-eliminado', ({ _id }: { _id: string }) => {
        setMensajes((prev) => prev.filter((m) => m._id !== _id));
      });
      socket.on('error-foro', ({ message }: { message: string }) => {
        setError(message);
        setCargando(false);
      });
      socket.on('connect_error', () => {
        setConectado(false);
        setCargando(false);
        setError((e) => e ?? 'No se pudo conectar al foro en tiempo real.');
      });
      socketRef.current = socket;
    }
    const s = socketRef.current;
    if (!s.connected) s.connect();
    return s;
  }, [token]);

  useEffect(() => {
    if (!idPrograma || !token) {
      setMensajes([]);
      setCargando(false);
      return;
    }
    const id = String(idPrograma);
    if (programaRef.current && programaRef.current !== id) {
      socketRef.current?.emit('leave-foro', { idPrograma: programaRef.current });
    }
    programaRef.current = id;
    setMensajes([]);
    setCargando(true);
    setError(null);

    const socket = ensureSocket();
    const payload = { idPrograma: id, nombrePrograma: nombreRef.current };
    const join = () => socket?.emit('join-foro', payload);
    if (socket?.connected) join();
    else socket?.once('connect', join);

    void fetchForoMensajes(id)
      .then((res) => {
        if (programaRef.current !== id) return;
        const lista = Array.isArray(res?.mensajes) ? res.mensajes : [];
        if (lista.length) setMensajes(lista);
        setCargando(false);
        setError(null);
      })
      .catch(() => {
        if (programaRef.current === id) setCargando(false);
      });
  }, [idPrograma, token, ensureSocket]);

  useEffect(() => {
    return () => {
      if (programaRef.current && socketRef.current) {
        socketRef.current.emit('leave-foro', { idPrograma: programaRef.current });
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const enviarMensaje = useCallback(
    (texto: string) => {
      const socket = socketRef.current;
      if (!socket?.connected || !idPrograma || !texto.trim()) return;
      socket.emit('enviar-mensaje', {
        idPrograma: String(idPrograma),
        texto: texto.trim(),
        nombrePrograma: nombreRef.current,
      });
    },
    [idPrograma],
  );

  return { mensajes, conectado, cargando, error, enviarMensaje };
}
