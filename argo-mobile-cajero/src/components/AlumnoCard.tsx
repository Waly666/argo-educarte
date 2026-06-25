import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { SurfaceCard } from './SurfaceCard';
import type { AlumnoListItem } from '../api/domain';
import { inicialesAlumno, nombreCompleto } from '../utils/format';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  alumno: AlumnoListItem;
  saldo?: number;
  pendientes?: number;
  onPress?: () => void;
  compact?: boolean;
  footer?: React.ReactNode;
};

function ContactLine({
  icon,
  text,
  color,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  muted: string;
}) {
  if (!text.trim()) return null;
  return (
    <View style={styles.contactLine}>
      <Ionicons name={icon} size={14} color={muted} />
      <ScaledText baseSize={12} style={{ color, flex: 1 }} numberOfLines={1}>
        {text}
      </ScaledText>
    </View>
  );
}

export function AlumnoCard({ alumno, saldo = 0, pendientes = 0, onPress, compact, footer }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const nombre = nombreCompleto(alumno) || `Doc ${alumno.numDoc}`;
  const ini = inicialesAlumno(alumno);
  const empresa = alumno.empresaNombre?.trim();
  const celular = alumno.celular?.trim();
  const correo = alumno.correo?.trim();
  const tieneSaldo = saldo > 0;

  const body = (
    <>
      <View style={styles.topRow}>
        <LinearGradient
          colors={highContrast ? [c.bgAlt, c.card] : ['#3578F0', '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <ScaledText baseSize={compact ? 13 : 15} style={{ color: highContrast ? c.primary : '#fff', fontWeight: '800' }}>
            {ini || '?'}
          </ScaledText>
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
            {tieneSaldo ? (
              <View style={[styles.saldoPill, { backgroundColor: c.warnBg, borderColor: c.warn }]}>
                <MoneyText value={saldo} baseSize={12} style={{ color: c.warn }} bold />
              </View>
            ) : (
              <View style={[styles.docPill, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
                <ScaledText baseSize={11} style={{ color: c.primary, fontWeight: '700' }}>
                  {alumno.numDoc}
                </ScaledText>
              </View>
            )}
          </View>

          {!compact || !tieneSaldo ? (
            <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 2 }}>
              Doc. {alumno.numDoc}
            </ScaledText>
          ) : null}

          <View style={styles.contactBlock}>
            <ContactLine icon="call-outline" text={celular || ''} color={c.text} muted={c.textSoft} />
            <ContactLine icon="mail-outline" text={correo || ''} color={c.text} muted={c.textSoft} />
          </View>

          {empresa ? (
            <View style={[styles.empresaRow, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
              <Ionicons name="business-outline" size={14} color={c.primary} />
              <ScaledText baseSize={12} style={{ color: c.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                {empresa}
              </ScaledText>
            </View>
          ) : null}

          {pendientes > 0 ? (
            <View style={styles.pendienteRow}>
              <Ionicons name="alert-circle-outline" size={13} color={c.warn} />
              <ScaledText baseSize={11} style={{ color: c.warn, fontWeight: '700' }}>
                {pendientes} saldo{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''}
              </ScaledText>
            </View>
          ) : null}
        </View>

        {onPress && !tieneSaldo ? (
          <Ionicons name="chevron-forward" size={20} color={c.textSoft} style={{ alignSelf: 'center' }} />
        ) : null}
      </View>

      {footer ? <View style={[styles.footer, { borderTopColor: c.border }]}>{footer}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.94 : 1 }]}
      >
        <SurfaceCard
          style={{
            ...styles.card,
            ...(tieneSaldo ? { borderColor: c.warn, borderWidth: 1.5 } : {}),
          }}
          elevated={!highContrast}
        >
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
  avatar: {
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
  docPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saldoPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  contactBlock: {
    gap: 4,
    marginTop: 2,
  },
  contactLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  empresaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  pendienteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
