import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { portalLogin, setTokenGetter } from '../api/client';
import type { PortalAuthRes, PortalSession } from '../api/types';
import { SERVIDOR_API_STORAGE_KEY, setRuntimeApiBase } from '../config/apiBase';
import { clearCachedPortalConfig } from '../storage/portalConfigCache';
import { initAppRuntime } from '../bootstrap/runtime';
import { secureDelete, secureGet, secureSet } from '../storage/safeStore';

const TOKEN_KEY = 'argo_aula_token';
const USER_KEY = 'argo_aula_user';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string; user: PortalSession };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  applyAuthResponse: (res: PortalAuthRes) => Promise<void>;
  signOut: () => Promise<void>;
  updateEmpresa: (empresaId: string | null, empresaNombre: string | null) => void;
  setServidor: (url: string) => Promise<void>;
  getServidor: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionFromAuth(res: PortalAuthRes): PortalSession {
  return {
    email: res.usuario.email,
    numDoc: res.usuario.numDoc,
    nombreCompleto: res.alumno.nombreCompleto,
    empresaId: res.alumno.empresaId ?? null,
    empresaNombre: res.alumno.empresaNombre ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    setTokenGetter(() => (state.status === 'signedIn' ? state.token : null));
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const timeout = setTimeout(() => {
        if (!cancelled) setState({ status: 'signedOut' });
      }, 4000);
      try {
        await initAppRuntime();
        const token = await secureGet(TOKEN_KEY);
        const rawUser = await secureGet(USER_KEY);
        if (token && rawUser) {
          const user = JSON.parse(rawUser) as PortalSession;
          setTokenGetter(() => token);
          if (!cancelled) setState({ status: 'signedIn', token, user });
        } else if (!cancelled) {
          setState({ status: 'signedOut' });
        }
      } catch {
        if (!cancelled) setState({ status: 'signedOut' });
      } finally {
        clearTimeout(timeout);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuthResponse = useCallback(async (res: PortalAuthRes) => {
    const user = sessionFromAuth(res);
    setTokenGetter(() => res.token);
    await secureSet(TOKEN_KEY, res.token);
    await secureSet(USER_KEY, JSON.stringify(user));
    setState({ status: 'signedIn', token: res.token, user });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await portalLogin(email.trim(), password);
    await applyAuthResponse(res);
  }, [applyAuthResponse]);

  const signOut = useCallback(async () => {
    setTokenGetter(() => null);
    await secureDelete(TOKEN_KEY);
    await secureDelete(USER_KEY);
    setState({ status: 'signedOut' });
  }, []);

  const updateEmpresa = useCallback((empresaId: string | null, empresaNombre: string | null) => {
    setState((s) => {
      if (s.status !== 'signedIn') return s;
      const user = { ...s.user, empresaId, empresaNombre };
      void secureSet(USER_KEY, JSON.stringify(user));
      return { ...s, user };
    });
  }, []);

  const setServidor = useCallback(async (url: string) => {
    setRuntimeApiBase(url);
    await secureSet(SERVIDOR_API_STORAGE_KEY, url);
    await clearCachedPortalConfig();
  }, []);

  const getServidor = useCallback(async () => {
    return (await secureGet(SERVIDOR_API_STORAGE_KEY)) ?? '';
  }, []);

  const value = useMemo(
    () => ({ state, signIn, applyAuthResponse, signOut, updateEmpresa, setServidor, getServidor }),
    [state, signIn, applyAuthResponse, signOut, updateEmpresa, setServidor, getServidor],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
