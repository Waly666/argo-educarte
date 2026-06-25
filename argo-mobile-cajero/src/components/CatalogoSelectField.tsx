import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SearchField } from './SearchField';
import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import type { CatalogoOption } from '../utils/alumnoCatalogo';

type Props = {
  label: string;
  value: string;
  options: CatalogoOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function CatalogoSelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seleccione…',
  required,
}: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState('');

  const etiqueta = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label || '';
  }, [options, value]);

  const filtradas = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [options, filtro]);

  function elegir(v: string) {
    onChange(v);
    setOpen(false);
    setFiltro('');
  }

  return (
    <View style={styles.wrap}>
      <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
        {label}{required ? ' *' : ''}
      </ScaledText>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: c.border, backgroundColor: c.card }]}
      >
        <ScaledText
          baseSize={15}
          style={{ color: etiqueta ? c.text : '#94a3b8', flex: 1 }}
          numberOfLines={2}
        >
          {etiqueta || placeholder}
        </ScaledText>
        <Ionicons name="chevron-down" size={18} color={c.textSoft} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: c.bg }]}>
          <View style={[styles.modalHead, { borderBottomColor: c.border }]}>
            <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800', flex: 1 }}>
              {label}
            </ScaledText>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
          </View>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <SearchField value={filtro} onChangeText={setFiltro} placeholder="Filtrar…" />
          </View>
          <FlatList
            data={filtradas}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={
              <ScaledText baseSize={14} style={{ color: c.textSoft, textAlign: 'center', marginTop: 24 }}>
                Sin opciones
              </ScaledText>
            }
            renderItem={({ item }) => {
              const on = item.value === value;
              return (
                <Pressable
                  onPress={() => elegir(item.value)}
                  style={[
                    styles.opt,
                    {
                      borderColor: on ? c.primary : c.border,
                      backgroundColor: on ? c.accentSoft : c.card,
                    },
                  ]}
                >
                  <ScaledText baseSize={14} style={{ color: c.text, fontWeight: on ? '700' : '500' }}>
                    {item.label}
                  </ScaledText>
                  {on ? <Ionicons name="checkmark-circle" size={20} color={c.primary} /> : null}
                </Pressable>
              );
            }}
          />
          {value ? (
            <Pressable
              onPress={() => elegir('')}
              style={[styles.clearBtn, { borderTopColor: c.border }]}
            >
              <ScaledText baseSize={14} style={{ color: c.danger, fontWeight: '700' }}>
                Limpiar selección
              </ScaledText>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 50,
    gap: 8,
  },
  modal: { flex: 1 },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  clearBtn: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
