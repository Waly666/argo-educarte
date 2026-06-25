import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import type { ModuleMeta } from '../theme/modules';

type Props = {
  module: ModuleMeta;
  onPress: () => void;
};

export function ModuleTile({ module, onPress }: Props) {
  const { buttonMultiplier, highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          minHeight: 132 * buttonMultiplier,
          backgroundColor: c.card,
          borderColor: c.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        !highContrast && styles.elevated,
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: highContrast ? c.bgAlt : module.tint },
        ]}
      >
        <Ionicons name={module.icon} size={28} color={module.color} />
      </View>
      <ScaledText
        baseSize={15}
        style={{ color: c.text, fontWeight: '700', marginTop: 10, textAlign: 'center' }}
      >
        {module.label}
      </ScaledText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    maxWidth: '48%',
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elevated: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
});
