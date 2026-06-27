import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScaledText } from './ScaledText';
import { usePortalBranding } from '../hooks/usePortalBranding';
import { useTheme } from '../context/ThemeContext';
import { space } from '../theme/spacing';

/** Barra superior institucional Educarte. */
export function InstBar() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { nombreEmpresa } = usePortalBranding();

  return (
    <View style={[styles.bar, { backgroundColor: c.headerBg, paddingTop: insets.top > 0 ? 0 : space.xs }]}>
      <ScaledText baseSize={11} style={styles.text} numberOfLines={1}>
        {nombreEmpresa} · Aula virtual
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
