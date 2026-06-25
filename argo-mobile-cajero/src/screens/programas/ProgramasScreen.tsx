import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from '../../components/SearchField';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { EmptyState } from '../../components/EmptyState';
import { ProgramaCard } from '../../components/ProgramaCard';
import { listarProgramas } from '../../api/programasApi';
import { fetchTiposCapacitacion } from '../../api/catalogosApi';
import type { ProgramaItem } from '../../api/domain';
import { parseTiposCap, type TipoCapOption } from '../../utils/programaDisplay';
import { useDebounced } from '../../hooks/useDebounced';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';

export default function ProgramasScreen() {
  const insets = useSafeAreaInsets();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [items, setItems] = useState<ProgramaItem[]>([]);
  const [tiposCap, setTiposCap] = useState<TipoCapOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, tipos] = await Promise.all([
        listarProgramas({ q: debounced, catalogo: true }),
        fetchTiposCapacitacion(),
      ]);
      setItems(rows);
      setTiposCap(parseTiposCap(tipos));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      <SurfaceCard style={styles.hero} elevated>
        <View style={styles.heroTop}>
          <View style={[styles.heroBadge, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="library" size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800' }}>
              Programas
            </ScaledText>
            <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 2 }}>
              Catálogo con tipo, horas y valor de matrícula
            </ScaledText>
          </View>
        </View>
      </SurfaceCard>

      <SearchField value={q} onChangeText={setQ} placeholder="Nombre, código o tipo…" />
      <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4, marginBottom: 4 }}>
        {items.length > 0
          ? `${items.length} programa${items.length === 1 ? '' : 's'}`
          : 'Escriba para buscar en el catálogo'}
      </ScaledText>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.idPrograma ?? it._id)}
        refreshing={loading}
        onRefresh={() => void load()}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 24 + insets.bottom },
          !items.length && styles.listEmpty,
        ]}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="book-outline"
              title="Sin programas"
              subtitle="No hay programas que coincidan con la búsqueda."
            />
          ) : null
        }
        renderItem={({ item }) => <ProgramaCard programa={item} tiposCap={tiposCap} />}
      />
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
});
