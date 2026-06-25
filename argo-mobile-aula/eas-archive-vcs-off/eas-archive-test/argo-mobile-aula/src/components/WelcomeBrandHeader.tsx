import React from 'react';
import { StyleSheet, View } from 'react-native';

import { APP_BRANDING } from '../config/appBranding';
import { useTheme } from '../context/ThemeContext';
import { PortalLogo } from './PortalLogo';
import { ScaledText } from './ScaledText';
import { space } from '../theme/spacing';
import { type } from '../theme/typography';

type Props = {
  logoWidth?: number;
  logoHeight?: number;
  light?: boolean;
};

export function WelcomeBrandHeader({ logoWidth = 168, logoHeight = 86, light = true }: Props) {
  const c = useTheme();

  return (
    <View style={styles.wrap}>
      <PortalLogo width={logoWidth} height={logoHeight} logoFrame="transparent" />
      <ScaledText
        baseSize={type.hero.fontSize}
        style={[
          styles.aulaVirtual,
          { color: light ? c.accent : c.primary },
        ]}
      >
        {APP_BRANDING.tituloApp}
      </ScaledText>
      <ScaledText
        baseSize={17}
        style={[styles.empresaNombre, { color: light ? c.text : c.text }]}
      >
        {APP_BRANDING.nombreEmpresa}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  aulaVirtual: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 2.5,
    marginTop: space.sm,
  },
  empresaNombre: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: space.xs,
    paddingHorizontal: space.md,
    lineHeight: 24,
  },
});
