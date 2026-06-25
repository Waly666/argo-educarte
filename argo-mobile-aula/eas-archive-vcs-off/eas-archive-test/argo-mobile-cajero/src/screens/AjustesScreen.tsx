import React from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ScaledText } from '../components/ScaledText';
import { PrimaryButton } from '../components/PrimaryButton';
import { AlertBannerStack } from '../components/AlertBannerStack';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAccessibility, TextScaleId } from '../context/AccessibilityContext';
import { useAlertPrefs } from '../context/AlertPrefsContext';
import { themeColors } from '../theme/colors';

const TEXT_OPTS: { id: TextScaleId; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'large', label: 'Grande' },
  { id: 'xlarge', label: 'Muy grande' },
  { id: 'xxlarge', label: 'Extra grande' },
];

type IonName = ComponentProps<typeof Ionicons>['name'];

export default function AjustesScreen() {
  const a11y = useAccessibility();
  const alertPrefs = useAlertPrefs();
  const c = themeColors(a11y.highContrast);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <AlertBannerStack />
      <ScrollView contentContainerStyle={styles.body}>
        <Section title="Modo visión asistida" icon="eye-outline" color={c.text}>
          <Row label="Activar modo para baja visión" color={c.text}>
            <Switch
              value={a11y.visionAssist}
              onValueChange={(v) => void a11y.patch({ visionAssist: v })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={a11y.visionAssist ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 4 }}>
            Aumenta texto, botones y alertas. También puede afinar cada opción abajo.
          </ScaledText>
        </Section>

        <Section title="Tamaño de texto" icon="text-outline" color={c.text}>
          <View style={styles.rowWrap}>
            {TEXT_OPTS.map((o) => (
              <PrimaryButton
                key={o.id}
                label={o.label}
                variant={a11y.textScale === o.id ? 'primary' : 'ghost'}
                onPress={() => void a11y.patch({ textScale: o.id })}
                style={{ marginBottom: 8, flex: 1, minWidth: '45%' }}
              />
            ))}
          </View>
        </Section>

        <Section title="Lectura" icon="contrast-outline" color={c.text}>
          <Row label="Contraste alto" color={c.text}>
            <Switch
              value={a11y.highContrast}
              onValueChange={(v) => void a11y.patch({ highContrast: v })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={a11y.highContrast ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
          <Row label="Texto en negrita" color={c.text}>
            <Switch
              value={a11y.boldText}
              onValueChange={(v) => void a11y.patch({ boldText: v })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={a11y.boldText ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
          <Row label="Reducir animaciones" color={c.text}>
            <Switch
              value={a11y.reduceMotion}
              onValueChange={(v) => void a11y.patch({ reduceMotion: v })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={a11y.reduceMotion ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
          <Row label="Alertas extra grandes" color={c.text}>
            <Switch
              value={a11y.alertScale === 'large'}
              onValueChange={(v) => void a11y.patch({ alertScale: v ? 'large' : 'normal' })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={a11y.alertScale === 'large' ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
        </Section>

        <Section title="Sonido y vibración" icon="notifications-outline" color={c.text}>
          <Row label="Sonido ARGO (único)" color={c.text}>
            <Switch
              value={alertPrefs.soundEnabled}
              onValueChange={(v) => void alertPrefs.patch({ soundEnabled: v })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={alertPrefs.soundEnabled ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
          <Row label="Vibración" color={c.text}>
            <Switch
              value={alertPrefs.vibrationEnabled}
              onValueChange={(v) => void alertPrefs.patch({ vibrationEnabled: v })}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={alertPrefs.vibrationEnabled ? '#4f46e5' : '#f8fafc'}
            />
          </Row>
          <ScaledText baseSize={13} style={{ color: c.textSoft }}>
            Las alertas nuevas reproducen un sonido distintivo y vibran. La configuración de qué
            alertas ver se hace en la app web (Roles y Alertas).
          </ScaledText>
        </Section>

        <PrimaryButton
          label="Restaurar estándar"
          variant="ghost"
          icon="refresh-outline"
          onPress={() => void a11y.reset()}
          fullWidth
        />
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: IonName;
  color: string;
  children: React.ReactNode;
}) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  return (
    <SurfaceCard style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: highContrast ? c.bgAlt : '#eef2ff' }]}>
          <Ionicons name={icon} size={18} color={c.primary} />
        </View>
        <ScaledText baseSize={17} style={{ color, fontWeight: '800', flex: 1 }}>
          {title}
        </ScaledText>
      </View>
      {children}
    </SurfaceCard>
  );
}

function Row({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <ScaledText baseSize={16} style={{ color, flex: 1 }}>
        {label}
      </ScaledText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 40, gap: 14 },
  section: { marginBottom: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
