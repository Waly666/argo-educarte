import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import type { ServicioItem } from '../api/domain';
import type { TipoServOption } from '../utils/servicioDisplay';
import {
  categoriaServicio,
  chipsServicio,
  gradienteServicio,
  iconoServicio,
  labelCategoriaServicio,
  labelTipoServicio,
  tarifasServicio,
} from '../utils/servicioDisplay';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  servicio: ServicioItem;
  tiposServ?: TipoServOption[];
  onPress?: () => void;
  compact?: boolean;
};

function MetaChip({
  label,
  c,
  tone = 'neutral',
  highContrast,
}: {
  label: string;
  c: ReturnType<typeof themeColors>;
  tone?: 'neutral' | 'tipo' | 'cat' | 'virtual' | 'facturable';
  highContrast: boolean;
}) {
  const tones = highContrast
    ? {
        neutral: { bg: c.bgAlt, border: c.border, text: c.text },
        tipo: { bg: c.bgAlt, border: c.border, text: c.primary },
        cat: { bg: c.bgAlt, border: c.border, text: c.accent },
        virtual: { bg: c.bgAlt, border: c.border, text: c.ok },
        facturable: { bg: c.bgAlt, border: c.border, text: c.primaryLight },
      }
    : {
        neutral: { bg: c.accentSoft, border: c.border, text: c.text },
        tipo: { bg: '#fce7f3', border: '#f9a8d4', text: '#be185d' },
        cat: { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
        virtual: { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' },
        facturable: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      };
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      <ScaledText baseSize={10} style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </ScaledText>
    </View>
  );
}

function TarifaPill({
  label,
  valor,
  c,
  tone,
}: {
  label: string;
  valor: number;
  c: ReturnType<typeof themeColors>;
  tone: 't1' | 't2' | 't3' | 'tv';
}) {
  const colors = {
    t1: { bg: c.accentSoft, border: c.border, label: c.textSoft, value: c.primary },
    t2: { bg: '#ecfeff', border: '#a5f3fc', label: '#0e7490', value: '#0e7490' },
    t3: { bg: '#f1f5f9', border: '#cbd5e1', label: '#475569', value: '#334155' },
    tv: { bg: '#ede9fe', border: '#c4b5fd', label: '#6d28d9', value: '#5b21b6' },
  };
  const t = colors[tone];
  return (
    <View style={[styles.tarifaPill, { backgroundColor: t.bg, borderColor: t.border }]}>
      <ScaledText baseSize={10} style={{ color: t.label, fontWeight: '600' }}>
        {label}
      </ScaledText>
      <MoneyText value={valor} baseSize={12} style={{ color: t.value }} bold />
    </View>
  );
}

export function ServicioCard({ servicio, tiposServ = [], onPress, compact }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const cat = categoriaServicio(servicio);
  const nombre = String(servicio.descrServicio || servicio.descripcion || 'Servicio').trim();
  const tipo = labelTipoServicio(servicio, tiposServ);
  const categoria = labelCategoriaServicio(cat);
  const tarifas = tarifasServicio(servicio);
  const idServ = String(servicio.idServ ?? '').trim();
  const programa = servicio.programaNombre?.trim();
  const progCodigo = servicio.programaCodigo?.trim();
  const extraChips = chipsServicio(servicio);
  const icon = iconoServicio(cat);
  const gradient = gradienteServicio(cat, highContrast);

  const body = (
    <>
      <View style={styles.topRow}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
          <Ionicons name={icon} size={compact ? 20 : 22} color={highContrast ? c.primary : '#fff'} />
        </LinearGradient>

        <View style={styles.main}>
          <View style={styles.titleRow}>
            <ScaledText
              baseSize={compact ? 15 : 16}
              style={{ color: c.text, fontWeight: '800', flex: 1 }}
              numberOfLines={2}
            >
              {nombre}
            </ScaledText>
            {idServ ? (
              <View style={[styles.idPill, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
                <ScaledText baseSize={10} style={{ color: c.textSoft, fontWeight: '700' }}>
                  #{idServ}
                </ScaledText>
              </View>
            ) : null}
          </View>

          <View style={styles.metaLine}>
            <Ionicons name="layers-outline" size={14} color={c.textSoft} />
            <ScaledText baseSize={12} style={{ color: c.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {tipo}
            </ScaledText>
          </View>

          <View style={styles.metaLine}>
            <Ionicons name="bookmark-outline" size={14} color={c.accent} />
            <ScaledText baseSize={12} style={{ color: c.textSoft, flex: 1 }} numberOfLines={1}>
              {categoria}
            </ScaledText>
          </View>

          {programa ? (
            <View style={[styles.programaRow, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
              <Ionicons name="book-outline" size={14} color={c.primary} />
              <View style={{ flex: 1 }}>
                <ScaledText baseSize={12} style={{ color: c.text, fontWeight: '600' }} numberOfLines={2}>
                  {programa}
                </ScaledText>
                {progCodigo ? (
                  <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 2 }}>
                    Cód. {progCodigo}
                  </ScaledText>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={[styles.programaRow, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
              <Ionicons name="globe-outline" size={14} color={c.textSoft} />
              <ScaledText baseSize={12} style={{ color: c.textSoft, fontWeight: '600' }}>
                Trámite o servicio independiente
              </ScaledText>
            </View>
          )}

          <View style={styles.chipsRow}>
            {tipo !== '—' ? <MetaChip label={tipo} c={c} tone="tipo" highContrast={highContrast} /> : null}
            <MetaChip label={categoria} c={c} tone="cat" highContrast={highContrast} />
            {extraChips.map((chip) => (
              <MetaChip
                key={chip}
                label={chip}
                c={c}
                tone={chip === 'Facturable' ? 'facturable' : 'neutral'}
                highContrast={highContrast}
              />
            ))}
          </View>
        </View>

        {onPress ? (
          <Ionicons name="chevron-forward" size={20} color={c.textSoft} style={{ alignSelf: 'center' }} />
        ) : null}
      </View>

      {tarifas.length ? (
        <View style={[styles.footer, { borderTopColor: c.border }]}>
          <View style={styles.footerHead}>
            <Ionicons name="cash-outline" size={15} color={c.primary} />
            <ScaledText baseSize={12} style={{ color: c.textSoft, fontWeight: '600' }}>
              Tarifas
            </ScaledText>
          </View>
          <View style={styles.tarifasRow}>
            {tarifas.map((t) => (
              <TarifaPill
                key={t.key}
                label={t.label}
                valor={t.valor}
                c={c}
                tone={t.key === 't1' ? 't1' : t.key === 't2' ? 't2' : t.key === 't3' ? 't3' : 'tv'}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.footer, { borderTopColor: c.border }]}>
          <ScaledText baseSize={12} style={{ color: c.textSoft, fontStyle: 'italic' }}>
            Sin tarifas configuradas
          </ScaledText>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}>
        <SurfaceCard style={styles.card} elevated={!highContrast}>
          {body}
        </SurfaceCard>
      </Pressable>
    );
  }

  return (
    <SurfaceCard style={styles.card} elevated={!highContrast}>
      {body}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, marginBottom: 12 },
  topRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 6, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  idPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  programaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  footerHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tarifasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tarifaPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    minWidth: 72,
  },
});
