import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import { fetchCuentasBancarias, fetchTiposPago } from '../api/catalogosApi';
import { previewPagoExtras, type PreviewServicioAdicionalItem } from '../api/configApi';
import type { CatalogoItem } from '../api/domain';
import {
  esEfectivoTipoPago,
  etiquetaCuenta,
  etiquetaTipoPago,
  validarPagoIntangible,
  type SoportePago,
} from '../utils/pago';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

export type { SoportePago } from '../utils/pago';

export type PagoCobroState = {
  idTipoPago: string;
  idCuentaBancaria: string;
  numComprobante: string;
  observaciones: string;
  soporte: SoportePago | null;
  extras: PreviewServicioAdicionalItem[];
  totalExtras: number;
};

type Props = {
  idLiquidaciones: string[];
  subtotalItems: number;
  value: PagoCobroState;
  onChange: (patch: Partial<PagoCobroState>) => void;
};

const empty: PagoCobroState = {
  idTipoPago: '1',
  idCuentaBancaria: '',
  numComprobante: '',
  observaciones: '',
  soporte: null,
  extras: [],
  totalExtras: 0,
};

export function pagoCobroStateInicial(): PagoCobroState {
  return { ...empty };
}

export function validarEstadoPago(
  state: PagoCobroState,
  tipos: CatalogoItem[],
): { ok: boolean; message?: string } {
  return validarPagoIntangible({
    idTipoPago: state.idTipoPago,
    tipos,
    idCuentaBancaria: state.idCuentaBancaria,
    numComprobante: state.numComprobante,
    soporteUri: state.soporte?.uri ?? null,
  });
}

export function PagoCobroFields({ idLiquidaciones, subtotalItems, value, onChange }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [tipos, setTipos] = useState<CatalogoItem[]>([]);
  const [cuentas, setCuentas] = useState<CatalogoItem[]>([]);

  useEffect(() => {
    void fetchTiposPago().then(setTipos);
    void fetchCuentasBancarias().then(setCuentas);
  }, []);

  const esEfectivo = useMemo(
    () => esEfectivoTipoPago(value.idTipoPago, tipos),
    [value.idTipoPago, tipos],
  );

  useEffect(() => {
    const ids = idLiquidaciones.filter(Boolean);
    if (!value.idTipoPago || !ids.length) {
      onChange({ extras: [], totalExtras: 0 });
      return;
    }
    let cancel = false;
    void previewPagoExtras(value.idTipoPago, ids)
      .then((r) => {
        if (cancel) return;
        onChange({
          extras: r.items ?? [],
          totalExtras: Number(r.totalExtras) || 0,
        });
      })
      .catch(() => {
        if (!cancel) onChange({ extras: [], totalExtras: 0 });
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.idTipoPago, idLiquidaciones.join('|')]);

  async function elegirSoporte() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso', 'Permita acceso a fotos para adjuntar el soporte.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    onChange({
      soporte: {
        uri: asset.uri,
        name: asset.fileName || `soporte-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      },
    });
  }

  const total = subtotalItems + (value.totalExtras || 0);

  return (
    <View style={styles.wrap}>
      <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
        Forma de pago
      </ScaledText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {tipos.map((t) => {
          const id = String(t.idTipoPago ?? t.codigo ?? t._id ?? '');
          const on = value.idTipoPago === id;
          return (
            <Pressable
              key={id}
              onPress={() =>
                onChange({
                  idTipoPago: id,
                  idCuentaBancaria: '',
                  numComprobante: '',
                  soporte: null,
                })
              }
              style={[styles.chip, { borderColor: c.border, backgroundColor: on ? c.primary : c.card }]}
            >
              <ScaledText baseSize={12} style={{ color: on ? '#fff' : c.text, fontWeight: '700' }}>
                {etiquetaTipoPago(t)}
              </ScaledText>
            </Pressable>
          );
        })}
      </ScrollView>

      {!esEfectivo ? (
        <View style={styles.block}>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 6 }}>
            Cuenta bancaria destino
          </ScaledText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {cuentas.map((cu) => {
              const id = String(cu.idCuentaBancaria ?? cu.codigo ?? cu._id ?? '');
              const on = value.idCuentaBancaria === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => onChange({ idCuentaBancaria: id })}
                  style={[styles.chipWide, { borderColor: c.border, backgroundColor: on ? c.accentSoft : c.card }]}
                >
                  <ScaledText baseSize={12} style={{ color: c.text, fontWeight: on ? '700' : '500' }}>
                    {etiquetaCuenta(cu)}
                  </ScaledText>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 10, marginBottom: 4 }}>
            N.º comprobante / referencia
          </ScaledText>
          <TextInput
            value={value.numComprobante}
            onChangeText={(t) => onChange({ numComprobante: t })}
            placeholder="Referencia del banco"
            placeholderTextColor="#94a3b8"
            style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]}
          />
          <Pressable
            onPress={() => void elegirSoporte()}
            style={[styles.soporteBtn, { borderColor: c.primary, backgroundColor: c.accentSoft }]}
          >
            <ScaledText baseSize={13} style={{ color: c.primary, fontWeight: '700' }}>
              {value.soporte ? 'Cambiar soporte (imagen)' : 'Adjuntar soporte (imagen)'}
            </ScaledText>
          </Pressable>
          {value.soporte ? (
            <Image source={{ uri: value.soporte.uri }} style={styles.preview} resizeMode="cover" />
          ) : null}
        </View>
      ) : null}

      {value.extras.length ? (
        <SurfaceCard elevated={false} style={{ padding: 10, marginTop: 8, gap: 4 }}>
          <ScaledText baseSize={13} style={{ color: c.textSoft, fontWeight: '600' }}>
            Servicios adicionales al cobrar
          </ScaledText>
          {value.extras.map((ex) => (
            <View key={`${ex.idServ}-${ex.descripcion}`} style={styles.extraRow}>
              <ScaledText baseSize={12} style={{ color: c.text, flex: 1 }}>{ex.descripcion}</ScaledText>
              <MoneyText value={ex.valor} baseSize={12} style={{ color: c.text }} />
            </View>
          ))}
        </SurfaceCard>
      ) : null}

      <View style={styles.totalRow}>
        <ScaledText baseSize={14} style={{ color: c.textSoft }}>Total estimado</ScaledText>
        <MoneyText value={total} baseSize={18} style={{ color: c.primary }} bold />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 4 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipWide: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, maxWidth: 260 },
  block: { marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  soporteBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  preview: { marginTop: 10, width: '100%', height: 120, borderRadius: 10 },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#cbd5e1',
  },
});
