import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenBody } from '../../components/ScreenBody';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { MoneyText } from '../../components/MoneyText';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CajaResumenPanel } from '../../components/CajaResumenPanel';
import { abrirCaja, cerrarCaja, fetchCajaActivaFull } from '../../api/cajaApi';
import type { CajaActivaFull } from '../../api/domain';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

export default function CajaScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [data, setData] = useState<CajaActivaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [efectivoCierre, setEfectivoCierre] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetchCajaActivaFull();
      setData(r);
      if (r.resumenParcial?.efectivoEsperado != null) {
        setEfectivoCierre(String(Math.round(r.resumenParcial.efectivoEsperado)));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar caja');
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

  const abierta = data?.abierta && data.sesion;
  const resumen = data?.resumenParcial ?? data?.sesion?.resumen;
  const sesion = data?.sesion;

  async function onAbrir() {
    const saldo = Number(saldoInicial.replace(/\D/g, '')) || 0;
    setBusy(true);
    setErr(null);
    try {
      await abrirCaja({ saldoInicial: saldo });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo abrir la caja');
    } finally {
      setBusy(false);
    }
  }

  async function onCerrar() {
    if (!sesion) return;
    const contado = Number(efectivoCierre.replace(/\D/g, '')) || 0;
    Alert.alert('Cerrar caja', `¿Cerrar turno #${sesion.idSesion} con ${contado.toLocaleString('es-CO')} en efectivo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setErr(null);
            try {
              await cerrarCaja(sesion.idSesion, { efectivoContado: contado });
              await load();
              Alert.alert('Caja cerrada', 'Turno cerrado correctamente.');
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'No se pudo cerrar');
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  const heroColors: [string, string] = abierta
    ? highContrast
      ? [c.card, c.bgAlt]
      : ['#059669', '#10b981']
    : highContrast
      ? [c.card, c.bgAlt]
      : ['#d97706', '#f59e0b'];

  return (
    <ScreenBody refreshing={loading} onRefresh={() => { setLoading(true); void load(); }}>
      <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.2)' }]}>
            <Ionicons
              name={abierta ? 'cash' : 'lock-closed-outline'}
              size={28}
              color={highContrast ? c.primary : '#fff'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.heroStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: abierta ? '#bbf7d0' : '#fde68a' }]} />
              <ScaledText
                baseSize={12}
                style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.9)', fontWeight: '700' }}
              >
                {abierta ? 'TURNO ACTIVO' : 'CAJA CERRADA'}
              </ScaledText>
            </View>
            <ScaledText baseSize={22} style={{ color: highContrast ? c.text : '#fff', fontWeight: '800', marginTop: 4 }}>
              {abierta ? `Caja #${sesion?.idSesion}` : 'Sin turno abierto'}
            </ScaledText>
            {abierta && sesion ? (
              <ScaledText baseSize={13} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.88)', marginTop: 6 }}>
                Desde {new Date(sesion.fechaApertura).toLocaleString('es-CO')}
                {sesion.sedeNombre ? `\n${sesion.sedeNombre}` : ''}
              </ScaledText>
            ) : (
              <ScaledText baseSize={13} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.88)', marginTop: 6 }}>
                Abra turno para registrar cobros e ingresos del día.
              </ScaledText>
            )}
          </View>
        </View>
        {abierta && resumen ? (
          <View style={[styles.heroSaldo, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.15)' }]}>
            <ScaledText baseSize={12} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)' }}>
              Saldo teórico actual
            </ScaledText>
            <MoneyText
              value={resumen.saldoTeorico}
              baseSize={24}
              style={{ color: highContrast ? c.text : '#fff' }}
              bold
            />
          </View>
        ) : null}
      </LinearGradient>

      {abierta && resumen ? <CajaResumenPanel resumen={resumen} /> : null}

      {!abierta ? (
        <SurfaceCard style={styles.section} elevated={!highContrast}>
          <View style={styles.sectionHead}>
            <Ionicons name="lock-open-outline" size={20} color={c.primary} />
            <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '800' }}>
              Abrir turno
            </ScaledText>
          </View>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 10 }}>
            Indique el efectivo con el que inicia la caja.
          </ScaledText>
          <TextInput
            value={saldoInicial}
            onChangeText={setSaldoInicial}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.textSoft}
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bgAlt }]}
          />
          <PrimaryButton
            label="Abrir caja"
            icon="lock-open-outline"
            onPress={() => void onAbrir()}
            disabled={busy}
            fullWidth
            style={{ marginTop: 14 }}
          />
        </SurfaceCard>
      ) : (
        <>
          <View style={styles.actionsGrid}>
            <AccionTile
              icon="wallet-outline"
              title="Cobros pendientes"
              subtitle="Liquidaciones con saldo"
              colors={highContrast ? [c.bgAlt, c.card] : ['#4f46e5', '#6366f1']}
              highContrast={highContrast}
              onPress={() => nav.navigate('CajaCobros')}
            />
            <AccionTile
              icon="swap-vertical-outline"
              title="Movimientos"
              subtitle="Ingresos y egresos"
              colors={highContrast ? [c.bgAlt, c.card] : ['#0891b2', '#06b6d4']}
              highContrast={highContrast}
              onPress={() => nav.navigate('CajaMovimientos')}
            />
          </View>

          <SurfaceCard style={styles.section} elevated={!highContrast}>
            <View style={styles.sectionHead}>
              <Ionicons name="lock-closed-outline" size={20} color={c.danger} />
              <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '800' }}>
                Cerrar turno
              </ScaledText>
            </View>
            <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 10 }}>
              Cuente el efectivo físico y confirme el cierre del turno.
            </ScaledText>
            {resumen?.efectivoEsperado != null ? (
              <View style={[styles.hintBox, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
                <Ionicons name="information-circle-outline" size={16} color={c.primary} />
                <ScaledText baseSize={12} style={{ color: c.text, flex: 1 }}>
                  Efectivo esperado:{' '}
                  <ScaledText baseSize={12} style={{ color: c.primary, fontWeight: '800' }}>
                    {Math.round(resumen.efectivoEsperado).toLocaleString('es-CO')} COP
                  </ScaledText>
                </ScaledText>
              </View>
            ) : null}
            <TextInput
              value={efectivoCierre}
              onChangeText={setEfectivoCierre}
              keyboardType="numeric"
              placeholder="Efectivo contado"
              placeholderTextColor={c.textSoft}
              style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bgAlt, marginTop: 10 }]}
            />
            <PrimaryButton
              label="Cerrar caja"
              icon="lock-closed-outline"
              variant="danger"
              onPress={() => void onCerrar()}
              disabled={busy}
              fullWidth
              style={{ marginTop: 14 }}
            />
          </SurfaceCard>
        </>
      )}

      {err ? (
        <View style={[styles.errBox, { backgroundColor: c.dangerBg, borderColor: c.danger }]}>
          <Ionicons name="alert-circle-outline" size={18} color={c.danger} />
          <ScaledText baseSize={14} style={{ color: c.danger, flex: 1 }}>{err}</ScaledText>
        </View>
      ) : null}
    </ScreenBody>
  );
}

function AccionTile({
  icon,
  title,
  subtitle,
  colors,
  highContrast,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  colors: [string, string];
  highContrast: boolean;
  onPress: () => void;
}) {
  const c = themeColors(highContrast);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.92 : 1 }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionTile}>
        <View style={[styles.actionIcon, { backgroundColor: highContrast ? c.bgAlt : 'rgba(255,255,255,0.2)' }]}>
          <Ionicons name={icon} size={22} color={highContrast ? c.primary : '#fff'} />
        </View>
        <ScaledText baseSize={14} style={{ color: highContrast ? c.text : '#fff', fontWeight: '800', marginTop: 10 }}>
          {title}
        </ScaledText>
        <ScaledText baseSize={11} style={{ color: highContrast ? c.textSoft : 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          {subtitle}
        </ScaledText>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={highContrast ? c.textSoft : 'rgba(255,255,255,0.7)'}
          style={{ position: 'absolute', right: 12, top: 12 }}
        />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    gap: 14,
  },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  heroSaldo: {
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  section: { padding: 16, marginBottom: 14, gap: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  actionsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionTile: {
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    position: 'relative',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  errBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
  },
});
