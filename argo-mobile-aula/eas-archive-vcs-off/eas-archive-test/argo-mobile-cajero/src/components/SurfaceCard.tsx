import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
};

export function SurfaceCard({ children, style, elevated = true }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: c.border,
        },
        elevated && !highContrast && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  elevated: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
});
