import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from './ScaledText';
import { SurfaceCard } from './SurfaceCard';
import { VerDocumentoButton } from './VerDocumentoButton';
import { certificadoHtmlPath } from '../api/certificadosApi';
import type { CertificadoItem } from '../api/domain';
import { coloresEstadoCertificado, labelEstadoCertificado } from '../utils/certificadoEstado';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  cert: CertificadoItem;
  onPressAlumno?: () => void;
};

function fmtFecha(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function MetaChip({ label, c }: { label: string; c: ReturnType<typeof themeColors> }) {
  return (
    <View style={[styles.chip, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
      <ScaledText baseSize={11} style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </ScaledText>
    </View>
  );
}

export function CertificadoFila({ cert, onPressAlumno }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const curso =
    cert.encabezado?.trim() ||
    cert.nomCert?.trim() ||
    cert.programaDescr?.trim() ||
    '—';
  const codigo = cert.codigoCert?.trim();
  const docTitulo = codigo ? `Certificado ${codigo}` : `Certificado ${curso}`;
  const estadoLabel = labelEstadoCertificado(cert);
  const estadoColors = coloresEstadoCertificado(cert, c);
  const empresa = cert.empresaNombre?.trim();
  const emitido = fmtFecha(cert.fechaEmision);
  const vence = fmtFecha(cert.fechaVencimiento);

  return (
    <SurfaceCard style={styles.card} elevated={!highContrast}>
      <View style={styles.topRow}>
        <LinearGradient
          colors={highContrast ? [c.bgAlt, c.card] : ['#0d9488', '#14b8a6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <Ionicons name="ribbon" size={22} color={highContrast ? c.primary : '#fff'} />
        </LinearGradient>

        <Pressable style={styles.main} onPress={onPressAlumno} disabled={!onPressAlumno}>
          <View style={styles.titleRow}>
            <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '800', flex: 1 }} numberOfLines={2}>
              {curso}
            </ScaledText>
            <View style={[styles.estadoBadge, { backgroundColor: estadoColors.bg, borderColor: estadoColors.color }]}>
              <ScaledText baseSize={10} style={{ color: estadoColors.color, fontWeight: '800' }}>
                {estadoLabel.toUpperCase()}
              </ScaledText>
            </View>
          </View>

          {cert.nombreCompleto ? (
            <View style={styles.metaLine}>
              <Ionicons name="person-outline" size={14} color={c.primary} />
              <ScaledText baseSize={13} style={{ color: c.primary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {cert.nombreCompleto}
                {cert.numDoc ? ` · ${cert.numDoc}` : ''}
              </ScaledText>
            </View>
          ) : cert.numDoc ? (
            <View style={styles.metaLine}>
              <Ionicons name="card-outline" size={14} color={c.textSoft} />
              <ScaledText baseSize={13} style={{ color: c.textSoft, fontWeight: '600' }}>
                Doc. {cert.numDoc}
              </ScaledText>
            </View>
          ) : null}

          {empresa ? (
            <View style={[styles.empresaRow, { backgroundColor: c.bgAlt, borderColor: c.border }]}>
              <Ionicons name="business-outline" size={15} color="#0d9488" />
              <ScaledText baseSize={12} style={{ color: c.text, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                {empresa}
              </ScaledText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.chipsRow}>
        {codigo ? <MetaChip label={`# ${codigo}`} c={c} /> : null}
        {cert.tipoFormatoCertLabel ? <MetaChip label={cert.tipoFormatoCertLabel} c={c} /> : null}
        {cert.codVerificacion ? <MetaChip label={`Verif. ${cert.codVerificacion}`} c={c} /> : null}
      </View>

      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <View style={styles.fechas}>
          {emitido ? (
            <View style={styles.fechaItem}>
              <Ionicons name="calendar-outline" size={13} color={c.textSoft} />
              <ScaledText baseSize={11} style={{ color: c.textSoft }}>
                Emitido {emitido}
              </ScaledText>
            </View>
          ) : null}
          {vence ? (
            <View style={styles.fechaItem}>
              <Ionicons
                name="time-outline"
                size={13}
                color={estadoLabel === 'Vencido' ? c.warn : c.textSoft}
              />
              <ScaledText
                baseSize={11}
                style={{
                  color: estadoLabel === 'Vencido' ? c.warn : c.textSoft,
                  fontWeight: estadoLabel === 'Vencido' ? '700' : '400',
                }}
              >
                Vence {vence}
              </ScaledText>
            </View>
          ) : null}
        </View>
        <VerDocumentoButton titulo={docTitulo} htmlPath={certificadoHtmlPath(cert._id)} />
      </View>
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
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  estadoBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaLine: {
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
    paddingVertical: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fechas: {
    flex: 1,
    gap: 4,
  },
  fechaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
