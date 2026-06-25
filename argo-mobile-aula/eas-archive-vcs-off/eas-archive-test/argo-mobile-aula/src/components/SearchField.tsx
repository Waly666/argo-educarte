import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
};

export function SearchField({ value, onChangeText, placeholder = 'Buscar…' }: Props) {
  const c = useTheme();
  return (
    <View style={[styles.wrap, shadow.sm, { borderColor: c.borderLight, backgroundColor: c.card }]}>
      <Ionicons name="search" size={20} color={c.primary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        style={[styles.input, { color: c.text }]}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={c.textSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
});
