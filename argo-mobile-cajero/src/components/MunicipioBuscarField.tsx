import React, { useEffect, useState } from 'react';
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
import { buscarMunicipios, type MunicipioItem } from '../api/catalogosApi';
import { useDebounced } from '../hooks/useDebounced';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  label: string;
  texto: string;
  onTextoChange: (text: string) => void;
  onSeleccion?: (m: MunicipioItem) => void;
  onLimpiar?: () => void;
  placeholder?: string;
};

export function MunicipioBuscarField({
  label,
  texto,
  onTextoChange,
  onSeleccion,
  onLimpiar,
  placeholder = 'Buscar municipio…',
}: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 300);
  const [items, setItems] = useState<MunicipioItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const term = debounced.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    void buscarMunicipios(term, 25)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [debounced, open]);

  function seleccionar(m: MunicipioItem) {
    onTextoChange(m.label);
    onSeleccion?.(m);
    setOpen(false);
    setQ('');
  }

  return (
    <View style={styles.wrap}>
      <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
        {label}
      </ScaledText>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: c.border, backgroundColor: c.card }]}
      >
        <Ionicons name="location-outline" size={18} color={c.primary} />
        <ScaledText
          baseSize={15}
          style={{ color: texto ? c.text : '#94a3b8', flex: 1 }}
          numberOfLines={2}
        >
          {texto || placeholder}
        </ScaledText>
        {texto ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onLimpiar?.();
              onTextoChange('');
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={20} color={c.textSoft} />
          </Pressable>
        ) : (
          <Ionicons name="search" size={18} color={c.textSoft} />
        )}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: c.bg }]}>
          <View style={[styles.modalHead, { borderBottomColor: c.border }]}>
            <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800', flex: 1 }}>
              {label}
            </ScaledText>
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
          </View>
          <View style={{ padding: 16 }}>
            <SearchField value={q} onChangeText={setQ} placeholder="Nombre, departamento o código…" />
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 8 }}>
              Escriba al menos 2 caracteres
            </ScaledText>
          </View>
          <FlatList
            data={items}
            keyExtractor={(m) => m.codMunicipio}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={
              !loading ? (
                <ScaledText baseSize={14} style={{ color: c.textSoft, textAlign: 'center', marginTop: 20 }}>
                  {debounced.trim().length < 2 ? 'Empiece a escribir…' : 'Sin municipios'}
                </ScaledText>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => seleccionar(item)}
                style={[styles.opt, { borderColor: c.border, backgroundColor: c.card }]}
              >
                <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                  {item.label}
                </ScaledText>
                <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 2 }}>
                  Cód. {item.codMunicipio}
                </ScaledText>
              </Pressable>
            )}
          />
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
    paddingHorizontal: 12,
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
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
});
