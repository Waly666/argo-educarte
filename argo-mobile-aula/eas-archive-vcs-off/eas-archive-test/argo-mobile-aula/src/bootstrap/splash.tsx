import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';

import { WelcomeBrandHeader } from '../components/WelcomeBrandHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { space } from '../theme/spacing';

SplashScreen.preventAutoHideAsync().catch(() => {});

function BrandedSplashOverlay() {
  const c = useTheme();

  return (
    <LinearGradient
      colors={c.gradientHero.length >= 3 ? c.gradientHero : [c.bg, c.bgSoft]}
      style={[StyleSheet.absoluteFill, styles.boot]}
      pointerEvents="auto"
    >
      <WelcomeBrandHeader />
      <ActivityIndicator size="large" color={c.accent} style={{ marginTop: space.xl }} />
    </LinearGradient>
  );
}

function SplashGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const booting = state.status === 'loading';

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <>
      {children}
      {booting ? <BrandedSplashOverlay /> : null}
    </>
  );
}

function BootstrapScreen() {
  const c = useTheme();

  return (
    <LinearGradient
      colors={c.gradientHero.length >= 3 ? c.gradientHero : [c.bg, c.bgSoft]}
      style={styles.boot}
    >
      <WelcomeBrandHeader />
      <ActivityIndicator size="large" color={c.accent} style={{ marginTop: space.xl }} />
    </LinearGradient>
  );
}

export { SplashGate, BootstrapScreen };

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
});
