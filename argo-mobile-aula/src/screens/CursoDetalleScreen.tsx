import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { CursoAcciones } from '../components/CursoAcciones';
import { ProgressBar } from '../components/ProgressBar';
import { ScaledText } from '../components/ScaledText';
import { SurfaceCard } from '../components/SurfaceCard';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePasarelaActiva } from '../hooks/usePasarelaActiva';
import { fetchCurso, fetchInscripcion, matricularCurso } from '../api/aulaApi';
import type { CursoVirtual, EstadoInscripcionVirtual } from '../api/types';
import { pctCurso } from '../utils/cursoUtils';
import { etiquetaPrecioCatalogo, fmtPrecioColombia } from '../utils/cursoPrecio';
import { resolveUploadUrl, resolvePlayerUrl } from '../utils/uploadUrl';
import type { RootStackParamList } from '../navigation/types';
import { radius, space } from '../theme/spacing';

export default function CursoDetalleScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CursoDetalle'>>();
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { state } = useAuth();
  const c = useTheme();
  const { pasarelaActiva } = usePasarelaActiva();
  const [curso, setCurso] = useState<CursoVirtual | null>(null);
  const [insc, setInsc] = useState<EstadoInscripcionVirtual | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const det = await fetchCurso(route.params.id);
      setCurso(det);
      if (state.status === 'signedIn') {
        try {
          const ins = await fetchInscripcion(route.params.id);
          setInsc(ins);
        } catch {
          setInsc(null);
        }
      } else {
        setInsc(null);
      }
    } catch (e) {
      Alert.alert('Curso', e instanceof Error ? e.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [route.params.id, state.status]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (state.status === 'signedIn') {
        void fetchInscripcion(route.params.id)
          .then(setInsc)
          .catch(() => setInsc(null));
      }
    }, [state.status, route.params.id]),
  );

  async function onMatricular() {
    setBusy(true);
    setMsg('');
    try {
      const res = await matricularCurso(route.params.id);
      setMsg(res.message);
      Alert.alert('Matrícula', res.message);
      await load();
    } catch (e) {
      Alert.alert('Matrícula', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  function onContinuar() {
    if (!curso) return;
    const url = resolvePlayerUrl(curso.playerUrl);
    if (!url) {
      Alert.alert('Curso', 'Este curso no tiene contenido disponible.');
      return;
    }
    nav.navigate('CoursePlayer', {
      idPrograma: String(curso.idPrograma),
      titulo: curso.nombreProg,
      playerUrl: url,
      storagePrefix: curso.storagePrefix ?? undefined,
    });
  }

  if (loading || !curso) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const img = resolveUploadUrl(curso.urlPortadaAbsoluta) || resolveUploadUrl(curso.urlPortadaVirtual);
  const matriculado = insc?.matriculado === true;
  const puedeEntrar = insc?.puedeCursar === true;
  const pct = pctCurso(curso);
  const precio = etiquetaPrecioCatalogo(curso);
  const signedIn = state.status === 'signedIn';

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          {img ? (
            <Image source={{ uri: img }} style={styles.img} resizeMode="cover" />
          ) : (
            <LinearGradient colors={c.gradientCourse} style={styles.img} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.imgOverlay}>
            {curso.categoriaNombre ? (
              <View style={styles.badge}>
                <ScaledText baseSize={11} style={{ color: '#fff', fontWeight: '700' }}>
                  {curso.categoriaNombre}
                </ScaledText>
              </View>
            ) : null}
            <ScaledText baseSize={22} style={styles.heroTitle}>
              {curso.nombreProg}
            </ScaledText>
            {curso.horas ? (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                <ScaledText baseSize={13} style={{ color: 'rgba(255,255,255,0.9)', marginLeft: 4 }}>
                  {curso.horas} horas
                </ScaledText>
              </View>
            ) : null}
          </LinearGradient>
        </View>

        {pct > 0 ? (
          <SurfaceCard style={{ marginBottom: space.lg }}>
            <ProgressBar pct={pct} label="Tu progreso" />
          </SurfaceCard>
        ) : null}

        <SurfaceCard style={{ marginBottom: space.lg }}>
          <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700', marginBottom: space.sm }}>
            Descripción
          </ScaledText>
          <ScaledText baseSize={15} style={{ color: c.textSoft, lineHeight: 23 }}>
            {curso.descripcionVirtual || curso.descripcion || 'Sin descripción.'}
          </ScaledText>
        </SurfaceCard>

        <SurfaceCard tint={c.accentSoft} accentLeft={c.accent}>
          <ScaledText baseSize={12} style={{ color: c.textSoft, fontWeight: '700', marginBottom: 4 }}>
            INVERSIÓN
          </ScaledText>
          <ScaledText baseSize={24} style={{ color: c.primary, fontWeight: '800', marginBottom: 4 }}>
            {precio.badgeTone === 'price' ? fmtPrecioColombia(curso.tarifaVirtual) : precio.badge}
          </ScaledText>
          <ScaledText baseSize={13} style={{ color: c.textSoft, lineHeight: 20 }}>
            {precio.hint}
          </ScaledText>
        </SurfaceCard>

        {msg ? (
          <ScaledText baseSize={13} style={{ color: c.ok, marginTop: space.md, textAlign: 'center', fontWeight: '600' }}>
            {msg}
          </ScaledText>
        ) : null}
      </ScrollView>

      <CursoAcciones
        curso={curso}
        inscripcion={insc}
        signedIn={signedIn}
        pasarelaActiva={pasarelaActiva}
        puedeEntrar={puedeEntrar}
        matriculado={matriculado}
        busyMatricula={busy}
        onMatricular={() => void onMatricular()}
        onContinuar={onContinuar}
        onRegistro={() => nav.navigate('Registro')}
        onLogin={() => nav.navigate('Login')}
        onPagoIniciado={() => void load()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: space.lg, paddingBottom: space.xl },
  heroWrap: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: space.lg },
  img: { width: '100%', height: 220 },
  imgOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: space.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  heroTitle: { color: '#fff', fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.xs },
});
