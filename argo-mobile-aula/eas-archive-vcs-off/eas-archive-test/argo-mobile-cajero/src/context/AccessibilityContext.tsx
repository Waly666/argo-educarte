import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storeGet, storeSet } from '../storage/safeStore';

export type TextScaleId = 'normal' | 'large' | 'xlarge' | 'xxlarge';
export type ButtonScaleId = 'normal' | 'large';

const STORAGE_KEY = 'argo_m_a11y';

const TEXT_SCALE: Record<TextScaleId, number> = {
  normal: 1,
  large: 1.28,
  xlarge: 1.55,
  xxlarge: 1.9,
};

const BUTTON_SCALE: Record<ButtonScaleId, number> = {
  normal: 1,
  large: 1.35,
};

export type AccessibilityPrefs = {
  visionAssist: boolean;
  textScale: TextScaleId;
  buttonScale: ButtonScaleId;
  highContrast: boolean;
  boldText: boolean;
  reduceMotion: boolean;
  alertScale: 'normal' | 'large';
};

const DEFAULT: AccessibilityPrefs = {
  visionAssist: false,
  textScale: 'normal',
  buttonScale: 'normal',
  highContrast: false,
  boldText: false,
  reduceMotion: false,
  alertScale: 'normal',
};

type Ctx = AccessibilityPrefs & {
  textMultiplier: number;
  buttonMultiplier: number;
  alertMultiplier: number;
  patch: (p: Partial<AccessibilityPrefs>) => Promise<void>;
  reset: () => Promise<void>;
};

const A11yCtx = createContext<Ctx | null>(null);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(DEFAULT);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await storeGet(STORAGE_KEY);
        if (raw) setPrefs({ ...DEFAULT, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const persist = useCallback(async (next: AccessibilityPrefs) => {
    setPrefs(next);
    await storeSet(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const patch = useCallback(
    async (p: Partial<AccessibilityPrefs>) => {
      const next = { ...prefs, ...p };
      if (p.visionAssist === true) {
        next.textScale = next.textScale === 'normal' ? 'xlarge' : next.textScale;
        next.buttonScale = 'large';
        next.alertScale = 'large';
        next.boldText = true;
      }
      if (p.visionAssist === false && prefs.visionAssist) {
        next.textScale = 'normal';
        next.buttonScale = 'normal';
        next.alertScale = 'normal';
      }
      await persist(next);
    },
    [persist, prefs],
  );

  const reset = useCallback(async () => {
    await persist(DEFAULT);
  }, [persist]);

  const value = useMemo<Ctx>(() => {
    const textMultiplier = TEXT_SCALE[prefs.textScale];
    const buttonMultiplier = BUTTON_SCALE[prefs.buttonScale];
    const alertMultiplier = prefs.alertScale === 'large' ? 1.35 : 1;
    return {
      ...prefs,
      textMultiplier,
      buttonMultiplier,
      alertMultiplier,
      patch,
      reset,
    };
  }, [prefs, patch, reset]);

  return <A11yCtx.Provider value={value}>{children}</A11yCtx.Provider>;
}

export function useAccessibility(): Ctx {
  const c = useContext(A11yCtx);
  if (!c) throw new Error('useAccessibility fuera de provider');
  return c;
}
