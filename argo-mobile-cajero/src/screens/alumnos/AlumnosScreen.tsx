import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from '../../components/SearchField';
import { ScaledText } from '../../components/ScaledText';
import { MoneyText } from '../../components/MoneyText';
import { EmptyState } from '../../components/EmptyState';
import { SurfaceCard } from '../../components/SurfaceCard';
import { AlumnoCard } from '../../components/AlumnoCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { buscarAlumnos, listarAlumnosRecientes } from '../../api/alumnosApi';
import type { AlumnoListItem } from '../../api/domain';
import { useDebounced } from '../../hooks/useDebounced';
import { nombreCompleto } from '../../utils/format';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

export default function AlumnosScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 350);
  const [items, setItems] = useState<AlumnoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modoBusqueda, setModoBusqueda] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const term = debounced.trim();
      if (term.length >= 2) {
        const r = await buscarAlumnos({ q: term, limit: 50 });
        setItems(r.items);
        setTotal(r.total);
        setModoBusqueda(true);
      } else {
        const r = await listarAlumnosRecientes(30);
        setItems(r.items);
        setTotal(r.total);
        setModoBusqueda(false);
      }
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function irDetalle(item: AlumnoListItem) {
    nav.navigate('AlumnoDetalle', {
      numDoc: String(item.numDoc),
      nombre: nombreCompleto(item),
      alumnoId: item._id,
    });
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <SurfaceCard style={styles.hero} elevated>
        <View style={styles.heroTop}>
          <View style={[styles.heroBadge, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="school" size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800' }}>
              Alumnos
            </ScaledText>
            <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 2 }}>
              Busque, cree y gestione matrículas y pagos
            </ScaledText>
          </View>
        </View>
        <PrimaryButton
          label="Crear nuevo alumno"
          icon="person-add-outline"
          onPress={() => nav.navigate('AlumnoCrear')}
          fullWidth
        />
      </SurfaceCard>

      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder="Documento, nombre, celular o correo…"
      />
      <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 8, marginBottom: 4 }}>
        {modoBusqueda
          ? `${total} resultado${total === 1 ? '' : 's'} para «${debounced.trim()}»`
          : total > 0
            ? `${total} alumno${total === 1 ? '' : 's'} recientes — escriba para filtrar`
            : 'Escriba al menos 2 caracteres para buscar en todo el registro'}
      </ScaledText>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => it._id}
        refreshing={loading}
        onRefresh={() => void load()}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 88 + insets.bottom },
          !items.length && styles.listEmpty,
        ]}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={modoBusqueda ? 'search-outline' : 'people-outline'}
              title={modoBusqueda ? 'Sin resultados' : 'Sin alumnos recientes'}
              subtitle={
                modoBusqueda
                  ? 'Pruebe otro nombre, documento o celular.'
                  : 'Cree el primer alumno con el botón de arriba.'
              }
            />
          ) : null
        }
        renderItem={({ item }) => (
          <AlumnoCard
            alumno={item}
            saldo={item.indicadores?.saldoTotal ?? 0}
            pendientes={item.indicadores?.saldosPendientes ?? 0}
            onPress={() => irDetalle(item)}
          />
        )}
      />

      <Pressable
        onPress={() => nav.navigate('AlumnoCrear')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: c.primary,
            bottom: 16 + insets.bottom,
            opacity: pressed ? 0.92 : 1,
          },
          !highContrast && styles.fabShadow,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Crear nuevo alumno"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  hero: { gap: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  listEmpty: { flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabShadow: {
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
