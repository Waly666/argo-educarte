import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from '../../components/SearchField';
import { ScaledText } from '../../components/ScaledText';
import { MoneyText } from '../../components/MoneyText';
import { EmptyState } from '../../components/EmptyState';
import { SurfaceCard } from '../../components/SurfaceCard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CobroPendienteCard } from '../../components/CobroPendienteCard';
import {
  PagoCobroFields,
  pagoCobroStateInicial,
  validarEstadoPago,
  type PagoCobroState,
} from '../../components/PagoCobroFields';
import { listarLiquidacionConSaldo } from '../../api/liquidacionApi';
import { crearIngreso, reciboIngresoHtmlPath } from '../../api/ingresosApi';
import { fetchTiposPago } from '../../api/catalogosApi';
import type { RootStackParamList } from '../../navigation/types';
import type { LiquidacionConSaldoItem } from '../../api/domain';
import { useDebounced } from '../../hooks/useDebounced';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';
import { esLiquidacionVirtual, mensajeErrorApi } from '../../utils/pago';

export default function CajaCobrosScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [items, setItems] = useState<LiquidacionConSaldoItem[]>([]);
  const [totales, setTotales] = useState({ saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [cobroItem, setCobroItem] = useState<LiquidacionConSaldoItem | null>(null);
  const [montoText, setMontoText] = useState('');
  const [pagoCobro, setPagoCobro] = useState<PagoCobroState>(() => pagoCobroStateInicial());
  const [tiposPago, setTiposPago] = useState<Awaited<ReturnType<typeof fetchTiposPago>>>([]);

  const load = useCallback(async () => {
    try {
      const [r, tipos] = await Promise.all([
        listarLiquidacionConSaldo({ q: debounced, limit: 80 }),
        fetchTiposPago().catch(() => []),
      ]);
      setItems(r.items);
      setTotales({ saldo: r.totales?.saldo ?? 0 });
      setTiposPago(tipos);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const cobroVirtual = cobroItem ? esLiquidacionVirtual(cobroItem) : false;

  function abrirCobro(item: LiquidacionConSaldoItem) {
    const saldo = Number(item.saldo) || 0;
    if (saldo <= 0) return;
    setCobroItem(item);
    setMontoText(String(Math.round(saldo)));
    setPagoCobro(pagoCobroStateInicial());
  }

  function cerrarCobro() {
    setCobroItem(null);
    setMontoText('');
    setPagoCobro(pagoCobroStateInicial());
  }

  function parseMonto(): number {
    const raw = montoText.replace(/[^\d]/g, '');
    return raw === '' ? 0 : Number(raw);
  }

  function patchPagoCobro(patch: Partial<PagoCobroState>) {
    setPagoCobro((s) => ({ ...s, ...patch }));
  }

  async function confirmarCobro() {
    if (!cobroItem) return;
    const saldo = Number(cobroItem.saldo) || 0;
    const valor = cobroVirtual ? saldo : parseMonto();
    if (valor <= 0) {
      Alert.alert('Cobro', 'Indique un valor mayor a cero.');
      return;
    }
    if (cobroVirtual && Math.abs(valor - saldo) > 0.0001) {
      Alert.alert(
        'Matrícula virtual',
        `Debe cobrarse el saldo completo (${Math.round(saldo).toLocaleString('es-CO')} COP).`,
      );
      return;
    }
    if (valor > saldo + 0.0001) {
      Alert.alert('Cobro', `El valor no puede superar el saldo (${saldo.toLocaleString('es-CO')}).`);
      return;
    }
    const valPago = validarEstadoPago(pagoCobro, tiposPago);
    if (!valPago.ok) {
      Alert.alert('Cobro', valPago.message ?? 'Complete los datos del pago.');
      return;
    }
    setPayingId(cobroItem._id);
    try {
      const ing = await crearIngreso(
        {
          numDoc: cobroItem.alumnoDoc ?? cobroItem.numDoc,
          idLiquidacion: cobroItem._id,
          valor,
          idTipoPago: pagoCobro.idTipoPago,
          idCuentaBancaria: pagoCobro.idCuentaBancaria || undefined,
          numComprobante: pagoCobro.numComprobante.trim() || undefined,
          observaciones: pagoCobro.observaciones.trim() || undefined,
        },
        pagoCobro.soporte,
      );
      const num = ing.numRecibo ?? ing._id;
      const tipo = valor >= saldo - 0.0001 ? 'Pago total' : 'Abono parcial';
      cerrarCobro();
      Alert.alert('Cobro registrado', `${tipo}\nRecibo #${num}`, [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Imprimir recibo',
          onPress: () =>
            nav.navigate('DocumentoViewer', {
              title: `Recibo ${num}`,
              htmlPath: reciboIngresoHtmlPath(ing._id),
            }),
        },
      ]);
      await load();
    } catch (e) {
      Alert.alert('Error', mensajeErrorApi(e));
    } finally {
      setPayingId(null);
    }
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <LinearGradient
        colors={highContrast ? [c.card, c.bgAlt] : ['#ea580c', '#f97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name="wallet" size={24} color={highContrast ? c.warn : '#fff'} />
          </View>
          <View style={{ flex: 1 }}>
            <ScaledText baseSize={12} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)', fontWeight: '700' }}>
              COBROS PENDIENTES
            </ScaledText>
            <ScaledText baseSize={18} style={{ color: highContrast ? c.text : '#fff', fontWeight: '800', marginTop: 2 }}>
              Por recaudar
            </ScaledText>
          </View>
        </View>
        <View style={[styles.heroTotal, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.15)' }]}>
          <ScaledText baseSize={12} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)' }}>
            Saldo total en lista
          </ScaledText>
          <MoneyText value={totales.saldo} baseSize={26} style={{ color: highContrast ? c.warn : '#fff' }} bold />
          <ScaledText baseSize={11} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.8)', marginTop: 4 }}>
            {items.length} liquidación{items.length === 1 ? '' : 'es'} con saldo
          </ScaledText>
        </View>
      </LinearGradient>

      <SearchField value={q} onChangeText={setQ} placeholder="Alumno, documento o servicio…" />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => it._id}
        refreshing={loading}
        onRefresh={() => { setLoading(true); void load(); }}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 24 + insets.bottom },
          !items.length && styles.listEmpty,
        ]}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Sin cobros pendientes"
              subtitle="No hay liquidaciones con saldo en este momento."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <CobroPendienteCard
            item={item}
            onPress={() => abrirCobro(item)}
            disabled={payingId === item._id}
          />
        )}
      />

      <Modal visible={!!cobroItem} transparent animationType="fade" onRequestClose={cerrarCobro}>
        <View style={styles.modalBackdrop}>
          <SurfaceCard style={{ ...styles.modalCard, backgroundColor: c.card }} elevated>
            {cobroItem ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <LinearGradient
                    colors={highContrast ? [c.bgAlt, c.card] : ['#4f46e5', '#6366f1']}
                    style={styles.modalIcon}
                  >
                    <Ionicons name="cash-outline" size={22} color={highContrast ? c.primary : '#fff'} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800' }}>
                      Registrar cobro
                    </ScaledText>
                    <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 2 }}>
                      Complete el pago y confirme
                    </ScaledText>
                  </View>
                </View>

                <CobroPendienteCard item={cobroItem} />

                {cobroVirtual ? (
                  <View style={[styles.virtualHint, { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }]}>
                    <Ionicons name="laptop-outline" size={16} color="#0e7490" />
                    <ScaledText baseSize={12} style={{ color: '#0e7490', fontWeight: '600', flex: 1 }}>
                      Matrícula virtual: solo pago del saldo completo
                    </ScaledText>
                  </View>
                ) : null}

                {!cobroVirtual ? (
                  <>
                    <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 4, marginBottom: 6 }}>
                      Valor a pagar (abono o total)
                    </ScaledText>
                    <TextInput
                      value={montoText}
                      onChangeText={(t) => setMontoText(t.replace(/[^\d]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={c.textSoft}
                      style={[styles.montoInput, { borderColor: c.border, color: c.text, backgroundColor: c.bgAlt }]}
                    />
                    <Pressable
                      onPress={() => setMontoText(String(Math.round(Number(cobroItem.saldo) || 0)))}
                      style={[styles.totalLink, { borderColor: c.primary, backgroundColor: c.accentSoft }]}
                    >
                      <Ionicons name="checkmark-done-outline" size={16} color={c.primary} />
                      <ScaledText baseSize={13} style={{ color: c.primary, fontWeight: '700' }}>
                        Usar saldo completo
                      </ScaledText>
                    </Pressable>
                    {parseMonto() > 0 && parseMonto() < (Number(cobroItem.saldo) || 0) - 0.0001 ? (
                      <ScaledText baseSize={12} style={{ color: c.warn, fontWeight: '700', marginTop: 8 }}>
                        Abono parcial
                      </ScaledText>
                    ) : null}
                  </>
                ) : (
                  <View style={[styles.modalSaldoBox, { backgroundColor: c.warnBg, borderColor: c.warn }]}>
                    <ScaledText baseSize={13} style={{ color: c.textSoft }}>Valor a cobrar</ScaledText>
                    <MoneyText value={cobroItem.saldo} baseSize={20} style={{ color: c.warn }} bold />
                  </View>
                )}

                <PagoCobroFields
                  idLiquidaciones={[cobroItem._id]}
                  subtotalItems={cobroVirtual ? Number(cobroItem.saldo) || 0 : parseMonto()}
                  value={pagoCobro}
                  onChange={patchPagoCobro}
                />
                <View style={styles.modalActions}>
                  <PrimaryButton label="Cancelar" variant="ghost" onPress={cerrarCobro} style={{ flex: 1 }} />
                  <PrimaryButton
                    label="Cobrar"
                    icon="cash-outline"
                    onPress={() => void confirmarCobro()}
                    disabled={payingId === cobroItem._id}
                    style={{ flex: 1 }}
                  />
                </View>
              </ScrollView>
            ) : null}
          </SurfaceCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  hero: { borderRadius: 18, padding: 16, gap: 12 },
  heroRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTotal: { borderRadius: 14, padding: 14, gap: 2 },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  listEmpty: { flexGrow: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { padding: 18, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  virtualHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  modalSaldoBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  montoInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
  },
  totalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
