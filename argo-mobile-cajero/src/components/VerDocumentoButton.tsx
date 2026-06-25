import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  titulo: string;
  htmlPath: string;
  label?: string;
};

export function VerDocumentoButton({ titulo, htmlPath, label = 'Imprimir' }: Props) {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  return (
    <Pressable
      onPress={() => nav.navigate('DocumentoViewer', { title: titulo, htmlPath })}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: c.primary, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Ionicons name="print-outline" size={16} color="#fff" />
      <ScaledText baseSize={12} style={{ color: '#fff', fontWeight: '700' }}>
        {label}
      </ScaledText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
