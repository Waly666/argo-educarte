import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import type { ProgramaItem } from '../api/domain';
import type { TipoCapOption } from '../utils/programaDisplay';
import {
  esProgramaActivo,
  gradientePrograma,
  horasPrograma,
  iconoPrograma,
  labelModalidadesPrograma,
  labelTipoPrograma,
  textoHorasPrograma,
} from '../utils/programaDisplay';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  programa: ProgramaItem;
  tiposCap?: TipoCapOption[];
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
  tone?: 'neutral' | 'tipo' | 'horas' | 'modalidad' | 'virtual';
  highContrast: boolean;
}) {
  const tones = highContrast
    ? {
        neutral: { bg: c.bgAlt, border: c.border, text: c.text },
        tipo: { bg: c.bgAlt, border: c.border, text: c.primary },
        horas: { bg: c.bgAlt, border: c.border, text: c.accent },
        modalidad: { bg: c.bgAlt, border: c.border, text: c.primaryLight },
        virtual: { bg: c.bgAlt, border: c.border, text: c.ok },
      }
    : {
        neutral: { bg: c.accentSoft, border: c.border, text: c.text },
        tipo: { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' },
        horas: { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
        modalidad: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
        virtual: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      };
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      <ScaledText baseSize={11} style={{ color: t.text, fontWeight: '700' }} numberOfLines={1}>
        {label}
      </ScaledText>
    </View>
  );
}

export function ProgramaCard({ programa, tiposCap = [], onPress, compact }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const activo = esProgramaActivo(programa);
  const tipo = labelTipoPrograma(programa, tiposCap);
  const horas = horasPrograma(programa);
  const horasTexto = textoHorasPrograma(programa);
  const modalidades = labelModalidadesPrograma(programa);
  const codigo = String(programa.codigoProg || programa.idPrograma || '').trim();
  const icon = iconoPrograma(programa);
  const gradient = gradientePrograma(programa, highContrast);

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
              {programa.nombreProg}
            </ScaledText>
            <View
              style={[
                styles.estadoBadge,
                {
                  backgroundColor: activo ? c.okBg : c.dangerBg,
                  borderColor: activo ? c.ok : c.danger,
                },
              ]}
            >
              <ScaledText
                baseSize={10}
                style={{ color: activo ? c.ok : c.danger, fontWeight: '800' }}
              >
                {(programa.estado || 'Activo').toUpperCase()}
              </ScaledText>
            </View>
          </View>

          {codigo ? (
            <View style={[styles.codigoRow, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
              <Ionicons name="barcode-outline" size={14} color={c.primary} />
              <ScaledText baseSize={12} style={{ color: c.primary, fontWeight: '700' }}>
                {codigo}
              </ScaledText>
            </View>
          ) : null}

          <View style={styles.metaLine}>
            <Ionicons name="layers-outline" size={14} color={c.textSoft} />
            <ScaledText baseSize={13} style={{ color: c.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>
              {tipo}
            </ScaledText>
          </View>

          <View style={styles.metaLine}>
            <Ionicons name="time-outline" size={14} color={horas > 0 ? '#0e7490' : c.textSoft} />
            <ScaledText
              baseSize={13}
              style={{ color: horas > 0 ? c.text : c.textSoft, fontWeight: horas > 0 ? '600' : '400', flex: 1 }}
              numberOfLines={1}
            >
              {horasTexto}
            </ScaledText>
          </View>

          <View style={styles.chipsRow}>
            {modalidades !== '—' ? (
              <MetaChip label={modalidades} c={c} tone="modalidad" highContrast={highContrast} />
            ) : null}
            {programa.esCapacitacionVirtual ? (
              <MetaChip label="Aula virtual" c={c} tone="virtual" highContrast={highContrast} />
            ) : null}
            {programa.semestres != null && Number(programa.semestres) >= 1 ? (
              <MetaChip label={`${programa.semestres} sem.`} c={c} tone="neutral" highContrast={highContrast} />
            ) : null}
          </View>
        </View>

        {onPress ? (
          <Ionicons name="chevron-forward" size={20} color={c.textSoft} style={{ alignSelf: 'center' }} />
        ) : null}
      </View>

      {programa.valorMatricula != null && programa.valorMatricula > 0 ? (
        <View style={[styles.footer, { borderTopColor: c.border }]}>
          <View style={styles.matriculaLabel}>
            <Ionicons name="wallet-outline" size={15} color={c.primary} />
            <ScaledText baseSize={12} style={{ color: c.textSoft, fontWeight: '600' }}>
              Matrícula
            </ScaledText>
          </View>
          <MoneyText value={programa.valorMatricula} baseSize={16} style={{ color: c.primary }} bold />
        </View>
      ) : null}
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
  card: {
    padding: 14,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  estadoBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codigoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matriculaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
