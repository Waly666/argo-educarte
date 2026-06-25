import React, { memo, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

function FormSelectInner({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccione…',
  disabled,
}: Props) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  return (
    <View style={styles.block}>
      <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
        {label}
      </ScaledText>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[
          styles.trigger,
          { borderColor: c.border, backgroundColor: c.inputBg, opacity: disabled ? 0.55 : 1 },
        ]}
      >
        <ScaledText
          baseSize={16}
          style={{ color: selected ? c.inputText : c.inputPlaceholder, flex: 1 }}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </ScaledText>
        <Ionicons name="chevron-down" size={18} color="#64748b" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 12 }]}>
          <View style={[styles.sheetHead, { borderBottomColor: c.border }]}>
            <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700', flex: 1 }}>
              {label}
            </ScaledText>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={c.textSoft} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value || item.label}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={[styles.option, active && { backgroundColor: `${c.primary}18` }]}
                >
                  <ScaledText
                    baseSize={15}
                    style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '400' }}
                  >
                    {item.label}
                  </ScaledText>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

export const FormSelect = memo(FormSelectInner);

const styles = StyleSheet.create({
  block: { marginBottom: space.md },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    minHeight: 48,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '62%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  option: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
