import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storeGet, storeSet } from '../storage/safeStore';

const KEY = 'argo_m_alert_prefs';

export type AlertPrefs = {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  ignoreSilentMode: boolean;
};

const DEFAULT: AlertPrefs = {
  soundEnabled: true,
  vibrationEnabled: true,
  ignoreSilentMode: false,
};

type Ctx = AlertPrefs & {
  patch: (p: Partial<AlertPrefs>) => Promise<void>;
};

const AlertPrefsCtx = createContext<Ctx | null>(null);

export function AlertPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await storeGet(KEY);
        if (raw) setPrefs({ ...DEFAULT, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const patch = useCallback(async (p: Partial<AlertPrefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    await storeSet(KEY, JSON.stringify(next));
  }, [prefs]);

  const value = useMemo(() => ({ ...prefs, patch }), [prefs, patch]);

  return <AlertPrefsCtx.Provider value={value}>{children}</AlertPrefsCtx.Provider>;
}

export function useAlertPrefs(): Ctx {
  const c = useContext(AlertPrefsCtx);
  if (!c) throw new Error('useAlertPrefs fuera de provider');
  return c;
}
