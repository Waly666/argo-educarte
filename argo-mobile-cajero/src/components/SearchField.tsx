import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchField({ value, onChangeText, placeholder = 'Buscar…', autoFocus }: Props) {
  const { textMultiplier, highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}>
      <Ionicons name="search-outline" size={20} color={c.textSoft} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.input, { color: c.text, fontSize: 16 * textMultiplier }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={8}
          accessibilityLabel="Limpiar búsqueda"
        >
          <Ionicons name="close-circle" size={20} color={c.textSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: { flex: 1, paddingVertical: 8 },
});
