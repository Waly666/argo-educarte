import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { fetchMisCursos } from '../api/aulaApi';
import type { CursoVirtual } from '../api/types';
import { useAuth } from '../context/AuthContext';

/** Carga mis-cursos al enfocar la pantalla y cuando el token está listo. */
export function useMisCursos() {
  const { state } = useAuth();
  const token = state.status === 'signedIn' ? state.token : null;
  const [cursos, setCursos] = useState<CursoVirtual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setCursos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMisCursos();
      setCursos(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setCursos([]);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los cursos');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { cursos, loading, error, reload };
}
