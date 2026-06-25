import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { APP_BRANDING, CAJERO_AZUL_REY } from '../config/appBranding';
import { ScaledText } from './ScaledText';

type Props = {
  logoWidth?: number;
  logoHeight?: number;
  /** Texto claro sobre fondo azul rey. */
  onDark?: boolean;
  showSubtitle?: boolean;
};

/** Logo de la empresa + título ARGO Cajero (como en el aula virtual). */
export function EmpresaBrandHeader({
  logoWidth = 168,
  logoHeight = 86,
  onDark = true,
  showSubtitle = true,
}: Props) {
  const titleColor = onDark ? '#ffffff' : CAJERO_AZUL_REY;
  const subColor = onDark ? 'rgba(255,255,255,0.92)' : '#334155';
  const empresaColor = onDark ? 'rgba(255,255,255,0.88)' : '#475569';

  return (
    <View style={styles.wrap}>
      <Image
        source={APP_BRANDING.logo}
        style={{ width: logoWidth, height: logoHeight }}
        resizeMode="contain"
      />
      <ScaledText baseSize={22} style={[styles.titulo, { color: titleColor }]}>
        {APP_BRANDING.tituloApp}
      </ScaledText>
      {showSubtitle ? (
        <>
          <ScaledText baseSize={16} style={[styles.empresa, { color: empresaColor }]}>
            {APP_BRANDING.nombreEmpresa}
          </ScaledText>
          <ScaledText baseSize={14} style={[styles.lead, { color: subColor }]}>
            Caja, alumnos y facturación
          </ScaledText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  titulo: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 12,
  },
  empresa: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  lead: {
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
