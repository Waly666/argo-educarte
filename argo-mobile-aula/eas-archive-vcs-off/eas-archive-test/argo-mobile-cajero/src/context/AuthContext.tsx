import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { fetchMe, login as apiLogin, setTokenGetter, bindSessionToken } from '../api/client';
import { setRuntimeApiBase, normalizeApiBaseUrl, SERVIDOR_API_STORAGE_KEY } from '../config/apiBase';
import { startAlertPoller, stopAlertPoller } from '../services/alertPoller';
import { unloadAlertSound } from '../services/alertSound';
import { getSedeActivaSync, loadSedeActiva, setSedeActiva } from '../storage/sedeStore';
import { storeDelete, storeGet, storeSet } from '../storage/safeStore';
import type { AuthUser } from '../api/types';
import { useAlertPrefs } from './AlertPrefsContext';
import { withTimeout } from '../utils/timeout';

const K_TOKEN = 'argo_m_token';
const K_USER = 'argo_m_user';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string; user: AuthUser };

type AuthCtx = {
  state: AuthState;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setServidor: (apiBase: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function sedePrincipal(user: AuthUser): string | null {
  const sedes = user.sedes || [];
  if (!sedes.length) return null;
  const principal = sedes.find((s) => s.esPrincipal);
  return (principal ?? sedes[0])?.idSede ?? null;
}

async function ensureSedeForUser(user: AuthUser): Promise<void> {
  await loadSedeActiva();
  if (getSedeActivaSync()) return;
  const actual = sedePrincipal(user);
  if (actual) await setSedeActiva(actual);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const alertPrefs = useAlertPrefs();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const bootstrapped = useRef(false);

  const startPollsRef = useRef<(user: AuthUser) => void>(() => undefined);
  startPollsRef.current = (user: AuthUser) => {
    void startAlertPoller({
      user,
      sound: alertPrefs.soundEnabled,
      vibration: alertPrefs.vibrationEnabled,
    });
  };

  useEffect(() => {
    setTokenGetter(() => (state.status === 'signedIn' ? state.token : null));
  }, [state]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    let cancelled = false;
    const safety = setTimeout(() => {
      if (!cancelled) setState((s) => (s.status === 'loading' ? { status: 'signedOut' } : s));
    }, 4000);

    void (async () => {
      try {
        const api = await storeGet(SERVIDOR_API_STORAGE_KEY);
        if (api) setRuntimeApiBase(api);

        const token = await storeGet(K_TOKEN);
        const userRaw = await storeGet(K_USER);
        if (cancelled) return;

        if (!token || !userRaw) {
          bindSessionToken(null);
          setState({ status: 'signedOut' });
          return;
        }

        let user: AuthUser;
        try {
          user = JSON.parse(userRaw) as AuthUser;
        } catch {
          await storeDelete(K_TOKEN);
          await storeDelete(K_USER);
          bindSessionToken(null);
          setState({ status: 'signedOut' });
          return;
        }

        setState({ status: 'signedIn', token, user });
        bindSessionToken(token);
        void ensureSedeForUser(user);

        try {
          const me = await withTimeout(fetchMe(), 8000, 'validar sesión');
          if (cancelled) return;
          await storeSet(K_USER, JSON.stringify(me));
          await ensureSedeForUser(me);
          setState({ status: 'signedIn', token, user: me });
          startPollsRef.current(me);
        } catch {
          if (cancelled) return;
          await storeDelete(K_TOKEN);
          await storeDelete(K_USER);
          bindSessionToken(null);
          setState({ status: 'signedOut' });
        }
      } catch {
        if (!cancelled) {
          bindSessionToken(null);
          setState({ status: 'signedOut' });
        }
      } finally {
        clearTimeout(safety);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safety);
      stopAlertPoller();
      void unloadAlertSound();
    };
  }, []);

  useEffect(() => {
    if (state.status !== 'signedIn') return;
    stopAlertPoller();
    startPollsRef.current(state.user);
  }, [alertPrefs.soundEnabled, alertPrefs.vibrationEnabled, state.status === 'signedIn' ? state.token : null]);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    bindSessionToken(res.token);
    let user = res.user;
    try {
      user = await fetchMe();
    } catch {
      /* usar usuario del login si /me falla momentáneamente */
    }
    await ensureSedeForUser(user);
    setState({ status: 'signedIn', token: res.token, user });
    void storeSet(K_TOKEN, res.token);
    void storeSet(K_USER, JSON.stringify(user));
    startPollsRef.current(user);
  }, []);

  const signOut = useCallback(async () => {
    stopAlertPoller();
    bindSessionToken(null);
    setState({ status: 'signedOut' });
    void unloadAlertSound();
    void storeDelete(K_TOKEN);
    void storeDelete(K_USER);
  }, []);

  const refreshUser = useCallback(async () => {
    if (state.status !== 'signedIn') return;
    const me = await fetchMe();
    setState({ status: 'signedIn', token: state.token, user: me });
    void storeSet(K_USER, JSON.stringify(me));
    stopAlertPoller();
    startPollsRef.current(me);
  }, [state]);

  const setServidor = useCallback(async (apiBase: string) => {
    const norm = normalizeApiBaseUrl(apiBase.trim());
    if (!norm) return;
    setRuntimeApiBase(norm);
    await storeSet(SERVIDOR_API_STORAGE_KEY, norm);
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signOut, refreshUser, setServidor }),
    [state, signIn, signOut, refreshUser, setServidor],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fuera de provider');
  return c;
}
