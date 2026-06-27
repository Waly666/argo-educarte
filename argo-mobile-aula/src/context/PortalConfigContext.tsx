import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { preloadPortalConfig } from '../bootstrap/runtime';
import { fetchPortalConfig } from '../api/aulaApi';
import type { PortalConfig, PortalTemaConfig } from '../api/types';
import { subscribeApiBase } from '../config/apiBase';
import { loadCachedPortalConfig, saveCachedPortalConfig } from '../storage/portalConfigCache';
import { useAuth } from './AuthContext';

const DEFAULT_TEMA: PortalTemaConfig = {
  colorPrimario: '#6366F1',
  colorPrimarioOscuro: '#4338CA',
  colorAcento: '#14B8A6',
  colorFondo: '#F8FAFC',
  colorSuperficie: '#FFFFFF',
  colorTexto: '#0F172A',
  colorTextoSecundario: '#64748B',
};

type PortalConfigContextValue = {
  config: PortalConfig | null;
  tema: PortalTemaConfig;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PortalConfigContext = createContext<PortalConfigContextValue | null>(null);

export function PortalConfigProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const c = await fetchPortalConfig();
      setConfig(c);
      await saveCachedPortalConfig(c);
    } catch {
      /* mantener config previa si falla un refresh */
    }
  }, []);

  // Precarga en cuanto monta (caché + API guardada), sin esperar auth.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadCachedPortalConfig();
      if (!cancelled && cached) {
        setConfig(cached);
        setLoading(false);
      }
      const c = await preloadPortalConfig();
      if (!cancelled && c) setConfig(c);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state.status === 'loading') return;
    void refresh();
  }, [state.status]);

  useEffect(
    () =>
      subscribeApiBase(() => {
        if (state.status === 'loading') return;
        void refresh();
      }),
    [state.status, refresh],
  );

  const tema = config?.site?.tema ?? DEFAULT_TEMA;

  const value = useMemo(
    () => ({ config, tema, loading, refresh }),
    [config, tema, loading, refresh],
  );

  return <PortalConfigContext.Provider value={value}>{children}</PortalConfigContext.Provider>;
}

export function usePortalConfig(): PortalConfigContextValue {
  const ctx = useContext(PortalConfigContext);
  if (!ctx) throw new Error('usePortalConfig outside provider');
  return ctx;
}
