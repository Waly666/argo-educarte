import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import type { CursoVirtual } from '../api/types';
import { ProgressBar } from './ProgressBar';
import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import { pctCurso } from '../utils/cursoUtils';
import { resolveUploadUrl } from '../utils/uploadUrl';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  curso: CursoVirtual;
  onPress: () => void;
};

export function ContinueCourseCard({ curso, onPress }: Props) {
  const c = useTheme();
  const img =
    resolveUploadUrl(curso.urlPortadaAbsoluta) || resolveUploadUrl(curso.urlPortadaVirtual);
  const pct = pctCurso(curso);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadow.md,
        { backgroundColor: c.card, borderColor: `${c.accent}33`, borderLeftWidth: 3, borderLeftColor: c.accent, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={styles.row}>
        {img ? (
          <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <LinearGradient colors={c.gradientHero} style={styles.thumb}>
            <Ionicons name="book-outline" size={28} color="#fff" />
          </LinearGradient>
        )}
        <View style={styles.body}>
          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700' }} numberOfLines={2}>
            {curso.nombreProg}
          </ScaledText>
          <View style={{ marginTop: space.md }}>
            <ProgressBar pct={pct} label="Progreso" />
          </View>
        </View>
        <View style={[styles.play, { overflow: 'hidden' }]}>
          <LinearGradient colors={c.gradientHero} style={StyleSheet.absoluteFill} />
          <Ionicons name="play" size={18} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  body: { flex: 1 },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
