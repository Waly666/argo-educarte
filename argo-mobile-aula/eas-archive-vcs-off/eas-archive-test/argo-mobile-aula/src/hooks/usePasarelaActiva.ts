import { useCallback, useEffect, useState } from 'react';

import { fetchPasarelaPublica } from '../api/aulaApi';

/** Estado de la pasarela Wompi — mismo endpoint que argo-aula-virtual. */
export function usePasarelaActiva() {
  const [pasarelaActiva, setPasarelaActiva] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await fetchPasarelaPublica();
      setPasarelaActiva(cfg.activo === true);
    } catch {
      setPasarelaActiva(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { pasarelaActiva, loading, reload };
}
