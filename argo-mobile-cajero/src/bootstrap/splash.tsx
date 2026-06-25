import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { ScaledText } from '../components/ScaledText';
import { APP_BRANDING, CAJERO_AZUL_REY, SPLASH_MIN_MS } from '../config/appBranding';
import { useAuth } from '../context/AuthContext';

const splashFull = require('../../assets/branding/splash-full.png');

/** Logo + título (login y pantallas internas). */
export function PreLoginBrand() {
  return (
    <View style={styles.brand}>
      <Image source={APP_BRANDING.logo} style={styles.logo} resizeMode="contain" />
      <ScaledText baseSize={24} style={styles.titulo}>
        ARGO Cajero
      </ScaledText>
    </View>
  );
}

/**
 * Splash azul a pantalla completa al arrancar.
 * La auth suele terminar en ms; se mantiene visible al menos SPLASH_MIN_MS.
 */
export function AppBootGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const authLoading = state.status === 'loading';
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  const revealAppSplash = useCallback(() => {
    if (nativeSplashHidden) return;
    setNativeSplashHidden(true);
    void SplashScreen.hideAsync();
  }, [nativeSplashHidden]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      revealAppSplash();
    });
    return () => cancelAnimationFrame(id);
  }, [revealAppSplash]);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  const showSplash = authLoading || !minTimeDone;

  return (
    <View style={styles.root}>
      {children}
      {showSplash ? (
        <View style={styles.overlay} pointerEvents="auto" onLayout={revealAppSplash}>
          <Image source={splashFull} style={styles.overlayImage} resizeMode="cover" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: CAJERO_AZUL_REY,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CAJERO_AZUL_REY,
    zIndex: 9999,
    elevation: 9999,
  },
  overlayImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  brand: { alignItems: 'center', width: '100%' },
  logo: { width: 220, height: 110 },
  titulo: {
    color: '#ffffff',
    fontWeight: '800',
    marginTop: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
