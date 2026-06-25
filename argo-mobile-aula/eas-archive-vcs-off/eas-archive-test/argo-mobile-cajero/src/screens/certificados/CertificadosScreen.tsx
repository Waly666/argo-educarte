import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { SearchField } from '../../components/SearchField';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { EmptyState } from '../../components/EmptyState';
import { CertificadoFila } from '../../components/CertificadoFila';
import { listarCertificadosGlobal } from '../../api/certificadosApi';
import type { CertificadoItem } from '../../api/domain';
import { useDebounced } from '../../hooks/useDebounced';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

export default function CertificadosScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [items, setItems] = useState<CertificadoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [emitidosHoy, setEmitidosHoy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await listarCertificadosGlobal({ q: debounced, limit: 120 });
      setItems(r.items ?? []);
      setTotal(r.total ?? r.items?.length ?? 0);
      setEmitidosHoy(r.emitidosHoy ?? 0);
    } catch (e) {
      setItems([]);
      setErr(e instanceof Error ? e.message : 'No se pudieron cargar los certificados');
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function irAlumno(cert: CertificadoItem) {
    const doc = cert.numDoc != null ? String(cert.numDoc) : '';
    const nombre = cert.nombreCompleto?.trim() || `Doc ${doc}`;
    if (!doc) return;
    nav.navigate('AlumnoDetalle', { numDoc: doc, nombre, alumnoId: cert.alumnoId ?? undefined });
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.searchWrap}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Código, alumno, documento o programa…"
        />
      </View>
      <View style={styles.stats}>
        <SurfaceCard style={styles.stat} elevated={false}>
          <ScaledText baseSize={12} style={{ color: c.textSoft }}>Total</ScaledText>
          <ScaledText baseSize={22} style={{ color: c.primary, fontWeight: '800', marginTop: 4 }}>
            {total}
          </ScaledText>
        </SurfaceCard>
        <SurfaceCard style={styles.stat} elevated={false}>
          <ScaledText baseSize={12} style={{ color: c.textSoft }}>Hoy</ScaledText>
          <ScaledText baseSize={22} style={{ color: c.ok, fontWeight: '800', marginTop: 4 }}>
            {emitidosHoy}
          </ScaledText>
        </SurfaceCard>
      </View>
      {err ? (
        <ScaledText baseSize={14} style={{ color: c.danger, marginHorizontal: 16, marginBottom: 8 }}>
          {err}
        </ScaledText>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(it) => it._id}
        refreshing={loading}
        onRefresh={() => void load()}
        contentContainerStyle={items.length ? styles.list : styles.listEmpty}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="ribbon-outline"
              title="Sin certificados"
              subtitle={debounced.trim() ? 'Pruebe otra búsqueda.' : 'No hay certificados emitidos.'}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <CertificadoFila cert={item} onPressAlumno={() => irAlumno(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: { padding: 16, paddingBottom: 8 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  stat: { flex: 1, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
});
