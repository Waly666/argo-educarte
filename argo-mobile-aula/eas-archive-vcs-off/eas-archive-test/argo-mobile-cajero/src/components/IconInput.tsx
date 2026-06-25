import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = TextInputProps & {
  label: string;
  icon: IonName;
  iconColor?: string;
};

export function IconInput({ label, icon, iconColor, style, ...rest }: Props) {
  const { textMultiplier, buttonMultiplier, highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const inputH = 52 * buttonMultiplier;

  return (
    <View style={styles.wrap}>
      <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
        {label}
      </ScaledText>
      <View
        style={[
          styles.field,
          {
            height: inputH,
            borderColor: c.border,
            backgroundColor: c.card,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: highContrast ? c.bgAlt : '#f1f5f9' }]}>
          <Ionicons name={icon} size={20} color={iconColor ?? c.primary} />
        </View>
        <TextInput
          placeholderTextColor="#94a3b8"
          style={[
            styles.input,
            {
              fontSize: 16 * textMultiplier,
              color: c.text,
            },
            style,
          ]}
          {...rest}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 48,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
  },
});
