import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { ContinueCourseCard } from '../../components/ContinueCourseCard';
import { PortalLogo } from '../../components/PortalLogo';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScaledText } from '../../components/ScaledText';
import { ScreenBody } from '../../components/ScreenBody';
import { SectionHeader } from '../../components/SectionHeader';
import { StatTile } from '../../components/StatTile';
import { SurfaceCard } from '../../components/SurfaceCard';
import { useAuth } from '../../context/AuthContext';
import { usePortalBranding } from '../../hooks/usePortalBranding';
import { usePortalConfig } from '../../context/PortalConfigContext';
import { useTheme } from '../../context/ThemeContext';
import { useMisCursos } from '../../hooks/useMisCursos';
import { fetchMisCertificados } from '../../api/aulaApi';
import type { CursoVirtual } from '../../api/types';
import {
  cursoCompletado,
  cursoEnProgreso,
  cursoParaContinuar,
  pctCurso,
  puedeCursar,
} from '../../utils/cursoUtils';
import { resolvePlayerUrl } from '../../utils/uploadUrl';
import type { AulaTabParamList, RootStackParamList } from '../../navigation/types';
import { radius, space } from '../../theme/spacing';
import { shadow } from '../../theme/shadows';

export default function TableroPanel() {
  const nav = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<AulaTabParamList, 'Tablero'>,
      StackNavigationProp<RootStackParamList>
    >
  >();
  const { state } = useAuth();
  const c = useTheme();
  const { nombreEmpresa } = usePortalBranding();
  const { refresh: refreshPortal } = usePortalConfig();
  const { cursos, loading, error, reload } = useMisCursos();
  const [certs, setCerts] = useState(0);
  const [certsLoading, setCertsLoading] = useState(true);

  const loadCerts = useCallback(async () => {
    if (state.status !== 'signedIn') {
      setCerts(0);
      setCertsLoading(false);
      return;
    }
    setCertsLoading(true);
    try {
      const certRows = await fetchMisCertificados();
      setCerts(certRows.length);
    } catch {
      setCerts(0);
    } finally {
      setCertsLoading(false);
    }
  }, [state.status]);

  useFocusEffect(
    useCallback(() => {
      void loadCerts();
      void refreshPortal();
    }, [loadCerts, refreshPortal]),
  );

  const enCurso = cursos.filter(cursoEnProgreso);
  const completados = cursos.filter(cursoCompletado);
  const continuar = [...cursos]
    .filter(cursoParaContinuar)
    .sort((a, b) => pctCurso(b) - pctCurso(a))
    .slice(0, 4);

  const nombre = state.status === 'signedIn' ? state.user.nombreCompleto : '';
  const primerNombre = nombre.split(' ')[0] || 'alumno';

  function abrir(curso: CursoVirtual) {
    if (!puedeCursar(curso)) {
      nav.navigate('CursoDetalle', { id: String(curso.idPrograma) });
      return;
    }
    const url = resolvePlayerUrl(curso.playerUrl);
    if (!url) return;
    nav.navigate('CoursePlayer', {
      idPrograma: String(curso.idPrograma),
      titulo: curso.nombreProg,
      playerUrl: url,
      storagePrefix: curso.storagePrefix ?? undefined,
    });
  }

  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'A';

  async function onRefresh() {
    await Promise.all([reload(), loadCerts()]);
  }

  return (
    <ScreenBody onRefresh={onRefresh} refreshing={loading || certsLoading}>
      <LinearGradient
        colors={c.gradientDashHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.dashHero, shadow.lg]}
      >
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <ScaledText baseSize={18} style={{ color: '#fff', fontWeight: '800' }}>
              {iniciales}
            </ScaledText>
          </View>
          <View style={styles.heroCopy}>
            <ScaledText baseSize={11} style={styles.heroKicker}>
              MI AULA VIRTUAL
            </ScaledText>
            <ScaledText baseSize={20} style={styles.heroName} numberOfLines={1}>
              Hola, {primerNombre}
            </ScaledText>
            <ScaledText baseSize={13} style={styles.heroSub}>
              Sigue tu formación con Educarte
            </ScaledText>
          </View>
        </View>
        <View style={styles.heroBrand}>
          <PortalLogo width={96} height={44} hideLetterFallback />
          <ScaledText baseSize={12} style={styles.heroEmpresa} numberOfLines={1}>
            {nombreEmpresa}
          </ScaledText>
        </View>
      </LinearGradient>

      {loading && cursos.length === 0 ? (
        <ActivityIndicator color={c.primary} style={{ marginVertical: space.xl }} />
      ) : null}

      {error ? (
        <SurfaceCard style={{ marginBottom: space.md }}>
          <ScaledText baseSize={14} style={{ color: c.danger, marginBottom: space.sm }}>
            {error}
          </ScaledText>
          <PrimaryButton label="Reintentar" onPress={() => void onRefresh()} variant="secondary" />
        </SurfaceCard>
      ) : null}

      <View style={styles.stats}>
        <StatTile label="Cursos" value={cursos.length} icon="book-outline" color={c.primary} softColor={c.accentSoft} />
        <StatTile label="En progreso" value={enCurso.length} icon="play-circle-outline" color={c.accent} softColor={c.foroSoft} />
        <StatTile label="Completados" value={completados.length} icon="checkmark-circle-outline" color={c.ok} softColor={c.okSoft} />
        <StatTile label="Certificados" value={certs} icon="ribbon-outline" color={c.gold} softColor={c.goldSoft} />
      </View>

      <View style={{ marginBottom: space.lg }}>
        <PrimaryButton
          label="Explorar cursos y matricularme"
          onPress={() => nav.navigate('Cursos')}
          icon="library-outline"
          fullWidth
        />
      </View>

      {continuar.length > 0 ? (
        <SurfaceCard style={{ marginTop: space.lg }} tint={c.accentSoft} accentLeft={c.accent}>
          <SectionHeader
            title="Continuar aprendiendo"
            subtitle="Retoma donde lo dejaste"
            icon="flash-outline"
            iconColor={c.accent}
            iconBg={c.foroSoft}
          />
          {continuar.map((curso) => (
            <ContinueCourseCard key={String(curso.idPrograma)} curso={curso} onPress={() => abrir(curso)} />
          ))}
        </SurfaceCard>
      ) : !loading && cursos.length === 0 ? (
        <SurfaceCard style={{ marginTop: space.lg }}>
          <EmptyState
            title="Aún no tienes cursos"
            subtitle="Explora el catálogo y matricúlate en tu primer programa"
            icon="school-outline"
          />
          <PrimaryButton
            label="Explorar cursos"
            onPress={() => nav.navigate('Cursos')}
            icon="library-outline"
            fullWidth
          />
        </SurfaceCard>
      ) : !loading && cursos.length > 0 ? (
        <SurfaceCard style={{ marginTop: space.lg }}>
          <ScaledText baseSize={15} style={{ color: c.textSoft, textAlign: 'center' }}>
            Tienes {cursos.length} curso(s) matriculado(s). Abre la pestaña Cursos para verlos todos.
          </ScaledText>
        </SurfaceCard>
      ) : null}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  dashHero: {
    borderRadius: radius.xl,
    padding: space.xl,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1 },
  heroKicker: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 1.4 },
  heroName: { color: '#fff', fontWeight: '800', marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.82)', marginTop: 4, lineHeight: 18 },
  heroBrand: {
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  heroEmpresa: { color: 'rgba(255,255,255,0.88)', marginTop: space.xs, fontWeight: '600' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'space-between' },
});
