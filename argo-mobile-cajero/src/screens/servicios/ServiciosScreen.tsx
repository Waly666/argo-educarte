import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from '../../components/SearchField';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { EmptyState } from '../../components/EmptyState';
import { ServicioCard } from '../../components/ServicioCard';
import { listarServicios } from '../../api/serviciosApi';
import { fetchTiposServicio } from '../../api/catalogosApi';
import type { ServicioItem } from '../../api/domain';
import { parseTiposServ, type TipoServOption } from '../../utils/servicioDisplay';
import { useDebounced } from '../../hooks/useDebounced';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';

export default function ServiciosScreen() {
  const insets = useSafeAreaInsets();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [items, setItems] = useState<ServicioItem[]>([]);
  const [tiposServ, setTiposServ] = useState<TipoServOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, tipos] = await Promise.all([
        listarServicios({ q: debounced, catalogo: true }),
        fetchTiposServicio(),
      ]);
      setItems(rows);
      setTiposServ(parseTiposServ(tipos));
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
            <Ionicons name="construct" size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800' }}>
              Servicios
            </ScaledText>
            <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 2 }}>
              Catálogo de cobros, tarifas y trámites
            </ScaledText>
          </View>
        </View>
      </SurfaceCard>

      <SearchField value={q} onChangeText={setQ} placeholder="Nombre, tipo o programa…" />
      <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4, marginBottom: 4 }}>
        {items.length > 0
          ? `${items.length} servicio${items.length === 1 ? '' : 's'}`
          : 'Escriba para buscar en el catálogo'}
      </ScaledText>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.idServ ?? it._id)}
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
              icon="pricetag-outline"
              title="Sin servicios"
              subtitle="No hay servicios que coincidan con la búsqueda."
            />
          ) : null
        }
        renderItem={({ item }) => <ServicioCard servicio={item} tiposServ={tiposServ} />}
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
