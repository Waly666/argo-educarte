import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { SearchField } from '../../components/SearchField';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { MoneyText } from '../../components/MoneyText';
import { EmptyState } from '../../components/EmptyState';
import { facturaHtmlPath, fetchFacturacionResumen, listarFacturas } from '../../api/facturacionApi';
import { VerDocumentoButton } from '../../components/VerDocumentoButton';
import type { FacturaElectronicaItem, FacturacionResumen } from '../../api/domain';
import { useDebounced } from '../../hooks/useDebounced';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';

export default function FacturacionScreen() {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [resumen, setResumen] = useState<FacturacionResumen | null>(null);
  const [items, setItems] = useState<FacturaElectronicaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, list] = await Promise.all([
        fetchFacturacionResumen(),
        listarFacturas({ q: debounced, limit: 40 }),
      ]);
      setResumen(r);
      setItems(list.items ?? []);
    } catch {
      setResumen(null);
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

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.searchWrap}>
        <SearchField value={q} onChangeText={setQ} placeholder="Número factura o documento…" />
      </View>
      {resumen ? (
        <View style={styles.stats}>
          <StatCard label="Emitidas" value={resumen.emitidas} color={c.primary} />
          <StatCard label="Validadas" value={resumen.validadas} color={c.ok} />
          <StatCard label="Rechazadas" value={resumen.rechazadas} color={c.danger} />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(it) => it._id}
        refreshing={loading}
        onRefresh={() => void load()}
        contentContainerStyle={items.length ? styles.list : styles.listEmpty}
        ListHeaderComponent={
          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', marginBottom: 10 }}>
            Facturas recientes
          </ScaledText>
        }
        ListEmptyComponent={
          !loading ? <EmptyState title="Sin facturas" subtitle="Emita desde la ficha del alumno (Pagos)." /> : null
        }
        renderItem={({ item }) => (
          <SurfaceCard style={styles.row} elevated={false}>
            <View style={{ flex: 1 }}>
              <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700' }}>
                {item.numeroFactura ?? 'Sin número'}
              </ScaledText>
              <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4 }}>
                {item.adquirente?.nombre ?? `Doc ${item.numDoc ?? ''}`} · {item.estado}
              </ScaledText>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <MoneyText value={item.valorTotal} baseSize={15} style={{ color: c.primary }} bold />
              <VerDocumentoButton
                titulo={`Factura ${item.numeroFactura ?? item._id}`}
                htmlPath={facturaHtmlPath(item._id)}
                label="Imprimir"
              />
            </View>
          </SurfaceCard>
        )}
      />
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  return (
    <SurfaceCard style={styles.stat} elevated={false}>
      <ScaledText baseSize={12} style={{ color: c.textSoft }}>{label}</ScaledText>
      <ScaledText baseSize={22} style={{ color, fontWeight: '800', marginTop: 4 }}>{value}</ScaledText>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: { padding: 16, paddingBottom: 8 },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  stat: { flex: 1, paddingVertical: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flexGrow: 1, paddingHorizontal: 16 },
  row: { marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
