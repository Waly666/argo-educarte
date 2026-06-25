import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenBody } from '../../components/ScreenBody';
import { ScaledText } from '../../components/ScaledText';
import { MoneyText } from '../../components/MoneyText';
import { EmptyState } from '../../components/EmptyState';
import { MovimientoCajaCard, type MovimientoCaja } from '../../components/MovimientoCajaCard';
import { fetchIngresosSesionActiva, fetchEgresosSesionActiva } from '../../api/cajaApi';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';

export default function CajaMovimientosScreen() {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [movs, setMovs] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [ing, egr] = await Promise.all([fetchIngresosSesionActiva(), fetchEgresosSesionActiva()]);
      const rows: MovimientoCaja[] = [];
      for (const r of ing as Record<string, unknown>[]) {
        rows.push({
          id: String(r.idIngreso ?? r._id ?? Math.random()),
          tipo: 'ingreso',
          label: String(r.servicio ?? r.conceptoLabel ?? r.pagador ?? 'Ingreso'),
          detalle: r.numRecibo ? `Recibo #${r.numRecibo}` : r.pagador ? String(r.pagador) : undefined,
          valor: Number(r.valor) || 0,
          fecha: String(r.fecha ?? ''),
        });
      }
      for (const r of egr as Record<string, unknown>[]) {
        rows.push({
          id: String(r.idEgreso ?? r._id ?? Math.random()),
          tipo: 'egreso',
          label: String(r.concepto ?? r.tipoEgresoDescr ?? 'Egreso'),
          valor: Number(r.valorEgreso) || 0,
          fecha: String(r.fechaEgreso ?? ''),
        });
      }
      rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
      setMovs(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar movimientos');
      setMovs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const totales = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    for (const m of movs) {
      if (m.tipo === 'ingreso') ingresos += m.valor;
      else egresos += m.valor;
    }
    return { ingresos, egresos, neto: ingresos - egresos };
  }, [movs]);

  return (
    <ScreenBody refreshing={loading} onRefresh={() => { setLoading(true); void load(); }}>
      <LinearGradient
        colors={highContrast ? [c.card, c.bgAlt] : ['#0891b2', '#06b6d4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="swap-vertical" size={24} color={highContrast ? c.accent : '#fff'} />
          </View>
          <View style={{ flex: 1 }}>
            <ScaledText baseSize={12} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)', fontWeight: '700' }}>
              MOVIMIENTOS DEL TURNO
            </ScaledText>
            <ScaledText baseSize={18} style={{ color: highContrast ? c.text : '#fff', fontWeight: '800', marginTop: 2 }}>
              {movs.length} movimiento{movs.length === 1 ? '' : 's'}
            </ScaledText>
          </View>
        </View>
        <View style={styles.totalsRow}>
          <View style={[styles.totalBox, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.15)' }]}>
            <ScaledText baseSize={11} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)' }}>
              Ingresos
            </ScaledText>
            <MoneyText value={totales.ingresos} baseSize={16} style={{ color: highContrast ? c.ok : '#fff' }} bold />
          </View>
          <View style={[styles.totalBox, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.15)' }]}>
            <ScaledText baseSize={11} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)' }}>
              Egresos
            </ScaledText>
            <MoneyText value={totales.egresos} baseSize={16} style={{ color: highContrast ? c.danger : '#fff' }} bold />
          </View>
          <View style={[styles.totalBox, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.15)' }]}>
            <ScaledText baseSize={11} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)' }}>
              Neto
            </ScaledText>
            <MoneyText value={totales.neto} baseSize={16} style={{ color: highContrast ? c.text : '#fff' }} bold />
          </View>
        </View>
      </LinearGradient>

      {err ? (
        <View style={[styles.errBox, { backgroundColor: c.dangerBg, borderColor: c.danger }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.danger} />
          <ScaledText baseSize={14} style={{ color: c.danger, flex: 1 }}>{err}</ScaledText>
        </View>
      ) : null}

      {!movs.length && !loading ? (
        <EmptyState
          icon="receipt-outline"
          title="Sin movimientos"
          subtitle="Abra caja o registre ingresos y egresos en este turno."
        />
      ) : (
        movs.map((m) => <MovimientoCajaCard key={m.id} mov={m} />)
      )}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, padding: 16, marginBottom: 14, gap: 12 },
  heroRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalsRow: { flexDirection: 'row', gap: 8 },
  totalBox: { flex: 1, borderRadius: 12, padding: 10, gap: 2 },
  errBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
});
