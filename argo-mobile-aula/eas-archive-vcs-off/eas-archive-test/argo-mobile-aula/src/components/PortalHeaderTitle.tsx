import React from 'react';
import { StyleSheet, View } from 'react-native';

import { usePortalBranding } from '../hooks/usePortalBranding';
import { useTheme } from '../context/ThemeContext';
import { PortalLogo } from './PortalLogo';
import { ScaledText } from './ScaledText';
import { space } from '../theme/spacing';

type Props = {
  subtitle?: string;
};

/** Título de navegación con logo e identidad de la empresa (modo claro). */
export function PortalHeaderTitle({ subtitle }: Props) {
  const { nombreEmpresa } = usePortalBranding();
  const c = useTheme();

  return (
    <View style={styles.row}>
      <PortalLogo width={44} height={40} hideLetterFallback style={styles.logo} />
      <View style={styles.copy}>
        <ScaledText baseSize={16} style={[styles.title, { color: c.headerTitle }]} numberOfLines={1}>
          {nombreEmpresa}
        </ScaledText>
        <ScaledText baseSize={11} style={[styles.sub, { color: c.headerSubtitle }]} numberOfLines={1}>
          {subtitle ?? 'Mi aula virtual'}
        </ScaledText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', maxWidth: 260 },
  logo: { marginRight: space.sm, alignItems: 'flex-start' },
  copy: { flexShrink: 1 },
  title: { fontWeight: '800' },
  sub: { marginTop: 1 },
});
