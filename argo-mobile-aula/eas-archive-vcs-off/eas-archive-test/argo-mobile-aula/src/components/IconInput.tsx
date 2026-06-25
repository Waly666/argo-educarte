import React, { memo } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';

type IonName = ComponentProps<typeof Ionicons>['name'];

type Props = TextInputProps & {
  placeholder?: string;
  icon?: IonName;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
};

function IconInputInner({
  value,
  onChangeText,
  placeholder,
  icon = 'person-outline',
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  ...rest
}: Props) {
  const c = useTheme();

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.inputBg }]}>
      <View style={[styles.iconBox, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.inputPlaceholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, { color: c.inputText }]}
        {...rest}
      />
    </View>
  );
}

export const IconInput = memo(IconInputInner);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, fontSize: 16, padding: 0 },
});
