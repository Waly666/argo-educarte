import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from './SearchField';
import { ScaledText } from './ScaledText';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import { coincideBusqueda, normalizarBlob } from '../utils/buscarTexto';

export type BuscarPickerOption = {
  id: string;
  title: string;
  subtitle?: string;
  /** Texto extra para filtrar (código, programa, etc.). */
  keywords?: string;
};

type BaseProps = {
  label: string;
  options: BuscarPickerOption[];
  placeholder?: string;
  hint?: string;
  emptyText?: string;
  modalTitle?: string;
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string;
  onChange: (id: string) => void;
};

type MultiProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (ids: string[]) => void;
};

type Props = SingleProps | MultiProps;

function filtrarOpciones(options: BuscarPickerOption[], q: string): BuscarPickerOption[] {
  const t = q.trim();
  if (!t) return options;
  return options.filter((o) => {
    const blob = normalizarBlob([o.title, o.subtitle, o.keywords, o.id]);
    return coincideBusqueda(blob, t);
  });
}

export function BuscarPickerField(props: Props) {
  const {
    label,
    options,
    placeholder = 'Toque para buscar y elegir…',
    hint,
    emptyText = 'Sin resultados',
    modalTitle,
  } = props;
  const multiple = props.multiple === true;
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState('');

  const filtradas = useMemo(() => filtrarOpciones(options, filtro), [options, filtro]);

  const etiquetaSingle = useMemo(() => {
    if (multiple) return '';
    const hit = options.find((o) => o.id === props.value);
    return hit?.title || '';
  }, [multiple, options, props]);

  const resumenMulti = useMemo(() => {
    if (!multiple) return '';
    const n = props.value.length;
    if (!n) return '';
    if (n === 1) {
      return options.find((o) => o.id === props.value[0])?.title || '1 seleccionado';
    }
    return `${n} servicios seleccionados`;
  }, [multiple, options, props]);

  function cerrar() {
    setOpen(false);
    setFiltro('');
  }

  function toggleMulti(id: string) {
    if (!multiple) return;
    const set = new Set(props.value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    props.onChange([...set]);
  }

  function elegirSingle(id: string) {
    if (multiple) return;
    props.onChange(id);
    cerrar();
  }

  function limpiar() {
    if (multiple) props.onChange([]);
    else props.onChange('');
    cerrar();
  }

  const tieneValor = multiple ? props.value.length > 0 : !!props.value;

  return (
    <View style={styles.wrap}>
      <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: 6, fontWeight: '600' }}>
        {label}
      </ScaledText>
      {hint ? (
        <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 8, lineHeight: 17 }}>
          {hint}
        </ScaledText>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: c.border, backgroundColor: c.card }]}
      >
        <Ionicons name="search-outline" size={18} color={c.primary} />
        <ScaledText
          baseSize={15}
          style={{ color: tieneValor ? c.text : '#94a3b8', flex: 1, fontWeight: tieneValor ? '600' : '400' }}
          numberOfLines={2}
        >
          {multiple ? resumenMulti || placeholder : etiquetaSingle || placeholder}
        </ScaledText>
        <Ionicons name="chevron-forward" size={18} color={c.textSoft} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={cerrar}>
        <View style={[styles.modal, { backgroundColor: c.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHead, { borderBottomColor: c.border }]}>
            <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800', flex: 1 }}>
              {modalTitle || label}
            </ScaledText>
            <Pressable onPress={cerrar} hitSlop={8}>
              <Ionicons name="close" size={26} color={c.text} />
            </Pressable>
          </View>
          <View style={styles.searchPad}>
            <SearchField
              value={filtro}
              onChangeText={setFiltro}
              placeholder="Escriba para filtrar…"
              autoFocus
            />
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 6 }}>
              {filtradas.length} de {options.length} · escriba nombre, código o palabras clave
            </ScaledText>
          </View>
          <FlatList
            data={filtradas}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 80 }}
            ListEmptyComponent={
              <ScaledText baseSize={14} style={{ color: c.textSoft, textAlign: 'center', marginTop: 32 }}>
                {emptyText}
              </ScaledText>
            }
            renderItem={({ item }) => {
              const on = multiple
                ? props.value.includes(item.id)
                : props.value === item.id;
              return (
                <Pressable
                  onPress={() => (multiple ? toggleMulti(item.id) : elegirSingle(item.id))}
                  style={[
                    styles.opt,
                    {
                      borderColor: on ? c.primary : c.border,
                      backgroundColor: on ? c.accentSoft : c.card,
                    },
                  ]}
                >
                  <Ionicons
                    name={multiple ? (on ? 'checkbox' : 'square-outline') : on ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={on ? c.primary : c.textSoft}
                  />
                  <View style={{ flex: 1 }}>
                    <ScaledText baseSize={14} style={{ color: c.text, fontWeight: on ? '700' : '500' }}>
                      {item.title}
                    </ScaledText>
                    {item.subtitle ? (
                      <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 3 }}>
                        {item.subtitle}
                      </ScaledText>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
          <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.card, paddingBottom: insets.bottom + 8 }]}>
            {multiple ? (
              <Pressable
                onPress={cerrar}
                style={[styles.footerBtn, { backgroundColor: c.primary }]}
              >
                <ScaledText baseSize={15} style={{ color: '#fff', fontWeight: '800' }}>
                  Listo ({props.value.length} seleccionado{props.value.length === 1 ? '' : 's'})
                </ScaledText>
              </Pressable>
            ) : null}
            {tieneValor ? (
              <Pressable onPress={limpiar} style={styles.clearBtn}>
                <ScaledText baseSize={14} style={{ color: c.danger, fontWeight: '700' }}>
                  Limpiar selección
                </ScaledText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10,
  },
  modal: { flex: 1 },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchPad: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  opt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  footerBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clearBtn: { alignItems: 'center', paddingVertical: 8 },
});
