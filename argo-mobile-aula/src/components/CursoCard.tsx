import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CursoVirtual } from '../api/types';
import { ProgressBar } from './ProgressBar';
import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { etiquetaPrecioCatalogo } from '../utils/cursoPrecio';
import { resolveUploadUrl } from '../utils/uploadUrl';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  curso: CursoVirtual;
  onPress: () => void;
  pct?: number;
  layout?: 'vertical' | 'horizontal';
};

export function CursoCard({ curso, onPress, pct, layout = 'vertical' }: Props) {
  const c = useTheme();
  const img =
    resolveUploadUrl(curso.urlPortadaAbsoluta) ||
    resolveUploadUrl(curso.urlPortadaVirtual) ||
    null;
  const progreso = pct ?? curso.progreso?.pctCompletitud ?? 0;
  const precio = etiquetaPrecioCatalogo(curso);

  if (layout === 'horizontal') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.hCard,
          shadow.sm,
          { backgroundColor: c.card, borderColor: c.borderLight, opacity: pressed ? 0.94 : 1 },
        ]}
      >
        {img ? (
          <Image source={{ uri: img }} style={styles.hImg} resizeMode="cover" />
        ) : (
          <LinearGradient colors={c.gradientCourse} style={styles.hImg} />
        )}
        <View style={styles.hBody}>
          <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700' }} numberOfLines={2}>
            {curso.nombreProg}
          </ScaledText>
          {curso.categoriaNombre ? (
            <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 4 }}>
              {curso.categoriaNombre}
            </ScaledText>
          ) : null}
          {progreso > 0 ? (
            <View style={{ marginTop: space.sm }}>
              <ProgressBar pct={progreso} showPct />
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textSoft} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadow.md,
        { backgroundColor: c.card, borderColor: c.borderLight, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <View style={styles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
        ) : (
          <LinearGradient colors={c.gradientCourse} style={[styles.img, styles.imgPh]}>
            <Ionicons name="school-outline" size={36} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
        )}
        {curso.categoriaNombre ? (
          <View style={[styles.badge, { backgroundColor: c.overlay }]}>
            <ScaledText baseSize={10} style={{ color: '#fff', fontWeight: '700' }}>
              {curso.categoriaNombre}
            </ScaledText>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700' }} numberOfLines={2}>
          {curso.nombreProg}
        </ScaledText>
        {progreso > 0 ? (
          <View style={styles.barWrap}>
            <ProgressBar pct={progreso} label="Tu avance" />
          </View>
        ) : (
          <View style={{ marginTop: space.sm }}>
            <View
              style={[
                styles.price,
                {
                  backgroundColor: precio.badgeTone === 'free' ? c.okSoft : c.accentSoft,
                },
              ]}
            >
              <ScaledText
                baseSize={13}
                style={{
                  color: precio.badgeTone === 'free' ? c.ok : c.primary,
                  fontWeight: '800',
                }}
              >
                {precio.badge}
              </ScaledText>
            </View>
            <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 4 }}>
              {precio.hint}
            </ScaledText>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.lg },
  imgWrap: { position: 'relative' },
  img: { width: '100%', height: 160 },
  imgPh: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: space.md,
    bottom: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  body: { padding: space.lg },
  barWrap: { marginTop: space.md },
  price: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  hCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
    gap: space.md,
  },
  hImg: { width: 64, height: 64, borderRadius: radius.md },
  hBody: { flex: 1 },
});
