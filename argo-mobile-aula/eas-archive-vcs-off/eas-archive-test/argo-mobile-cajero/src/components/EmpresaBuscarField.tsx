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
import { buscarClientes, labelCliente, type ClienteItem } from '../api/clientesApi';
import { useDebounced } from '../hooks/useDebounced';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  empresaId: string | null;
  empresaNombre: string;
  onChange: (id: string | null, nombre: string) => void;
};

export function EmpresaBuscarField({ empresaId, empresaNombre, onChange }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 350);
  const [items, setItems] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const term = debounced.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    void buscarClientes(term)
      .then((rows) => setItems(rows.slice(0, 15)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [debounced, open]);

  function seleccionar(cl: ClienteItem) {
    onChange(cl._id, labelCliente(cl));
    setOpen(false);
    setQ('');
  }

  function limpiar() {
    onChange(null, '');
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: c.border, backgroundColor: c.card }]}
      >
        <Ionicons name="business-outline" size={20} color={c.primary} />
        <View style={{ flex: 1 }}>
          <ScaledText baseSize={14} style={{ color: empresaNombre ? c.text : '#94a3b8', fontWeight: '600' }}>
            {empresaNombre || 'Buscar empresa / organización…'}
          </ScaledText>
          {empresaId ? (
            <ScaledText baseSize={11} style={{ color: c.ok, marginTop: 2, fontWeight: '600' }}>
              NIT/ID vinculado
            </ScaledText>
          ) : (
            <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 2 }}>
              Sin empresa — alumno independiente
            </ScaledText>
          )}
        </View>
        {empresaId ? (
          <Pressable onPress={limpiar} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={c.textSoft} />
          </Pressable>
        ) : null}
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { backgroundColor: c.bg }]}>
          <View style={[styles.modalHead, { borderBottomColor: c.border }]}>
            <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800', flex: 1 }}>
              Empresa
            </ScaledText>
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
          </View>
          <View style={{ padding: 16 }}>
            <SearchField value={q} onChangeText={setQ} placeholder="Razón social, NIT o nombre…" />
          </View>
          <FlatList
            data={items}
            keyExtractor={(it) => it._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={
              !loading ? (
                <ScaledText baseSize={14} style={{ color: c.textSoft, textAlign: 'center', marginTop: 20 }}>
                  {debounced.trim().length < 2 ? 'Escriba para buscar clientes' : 'Sin coincidencias'}
                </ScaledText>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => seleccionar(item)}
                style={[styles.opt, { borderColor: c.border, backgroundColor: c.card }]}
              >
                <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700' }}>
                  {labelCliente(item)}
                </ScaledText>
                {item.identificacion ? (
                  <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4 }}>
                    {item.identificacion}
                  </ScaledText>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
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
    padding: 14,
    gap: 10,
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
