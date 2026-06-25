import React from 'react';
import { Linking, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePortalConfig } from '../context/PortalConfigContext';
import { whatsappHref, whatsappTelefono } from '../utils/whatsapp';
import { shadow } from '../theme/shadows';

type Props = {
  /** Espacio extra sobre el borde inferior (p. ej. barra de pestañas). */
  extraBottom?: number;
};

/** Botón flotante verde — igual que .wa-float del portal web. */
export function WhatsAppFloatButton({ extraBottom = 0 }: Props) {
  const { config } = usePortalConfig();
  const insets = useSafeAreaInsets();
  const telefono = whatsappTelefono(config);
  const href = whatsappHref(telefono);

  if (!href) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`WhatsApp ${telefono}`}
      onPress={() => void Linking.openURL(href)}
      style={({ pressed }) => [
        styles.btn,
        shadow.lg,
        {
          bottom: 20 + insets.bottom + extraBottom,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Ionicons name="logo-whatsapp" size={30} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 20,
    zIndex: 999,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25d366',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
});
