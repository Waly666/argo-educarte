import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import * as alertStore from '../services/alertStore';
import type { RootStackParamList } from '../navigation/types';

export function AlertBannerStack() {
  const [items, setItems] = useState(alertStore.getAlertas());
  const { alertMultiplier, highContrast, reduceMotion } = useAccessibility();
  const c = themeColors(highContrast);
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    return alertStore.subscribe(() => setItems(alertStore.getAlertas()));
  }, []);

  if (!items.length) return null;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      {items.map((a) => (
        <View
          key={a.id}
          style={[
            styles.banner,
            {
              minHeight: 72 * alertMultiplier,
              backgroundColor: a.critico ? c.dangerBg : c.warnBg,
              borderColor: a.critico ? c.danger : c.warn,
            },
            !reduceMotion && styles.pulse,
          ]}
        >
          <View style={styles.leadIcon}>
            <Ionicons
              name={a.critico ? 'warning-outline' : 'notifications-outline'}
              size={22}
              color={a.critico ? c.danger : c.warn}
            />
          </View>
          <Pressable
            style={styles.body}
            onPress={() => {
              if (a.documento) {
                nav.navigate('DocumentoViewer', a.documento);
                return;
              }
              if (a.route) nav.navigate(a.route as 'Caja' | 'Facturacion' | 'Alumnos' | 'Home');
            }}
          >
            <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800' }}>
              {a.titulo}
            </ScaledText>
            <ScaledText baseSize={14} style={{ color: c.textSoft, marginTop: 4 }} numberOfLines={2}>
              {a.detalle}
            </ScaledText>
          </Pressable>
          <Pressable
            style={[styles.close, { minWidth: 56 * alertMultiplier, minHeight: 48 * alertMultiplier }]}
            onPress={() => alertStore.dismiss(a.id)}
            accessibilityLabel="Cerrar alerta"
          >
            <Ionicons name="close" size={22} color={c.text} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
  },
  leadIcon: {
    paddingLeft: 12,
    paddingRight: 4,
    justifyContent: 'center',
  },
  body: { flex: 1, paddingVertical: 12, paddingRight: 8 },
  close: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  pulse: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
});
