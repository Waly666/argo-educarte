import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { CursoCard } from '../../components/CursoCard';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenBody } from '../../components/ScreenBody';
import { SectionHeader } from '../../components/SectionHeader';
import { ScaledText } from '../../components/ScaledText';
import { SurfaceCard } from '../../components/SurfaceCard';
import { useTheme } from '../../context/ThemeContext';
import { usePasarelaActiva } from '../../hooks/usePasarelaActiva';
import { useMisCursos } from '../../hooks/useMisCursos';
import { fetchInscripcion } from '../../api/aulaApi';
import type { CursoVirtual, EstadoInscripcionVirtual } from '../../api/types';
import { puedeCursar } from '../../utils/cursoUtils';
import { abrirPagoEnLineaCurso, puedeMostrarPagoEnLinea } from '../../utils/pagoVirtual';
import { resolvePlayerUrl } from '../../utils/uploadUrl';
import type { AulaTabParamList, RootStackParamList } from '../../navigation/types';
import { space } from '../../theme/spacing';

function CursoMatriculadoRow({
  curso,
  pasarelaActiva,
  onRefresh,
}: {
  curso: CursoVirtual;
  pasarelaActiva: boolean;
  onRefresh: () => void;
}) {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const c = useTheme();
  const [ins, setIns] = useState<EstadoInscripcionVirtual | null>(null);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchInscripcion(curso.idPrograma)
      .then((row) => {
        if (!cancelled) setIns(row);
      })
      .catch(() => {
        if (!cancelled) setIns(null);
      });
    return () => {
      cancelled = true;
    };
  }, [curso.idPrograma]);

  const puedeEntrar = puedeCursar(curso) && ins?.puedeCursar !== false;
  const mostrarPago = ins ? puedeMostrarPagoEnLinea(ins, curso) : false;

  const irDetalle = useCallback(() => {
    nav.navigate('CursoDetalle', { id: String(curso.idPrograma), titulo: curso.nombreProg });
  }, [nav, curso.idPrograma, curso.nombreProg]);

  async function onPagar() {
    if (!pasarelaActiva) {
      irDetalle();
      return;
    }
    setPagando(true);
    try {
      await abrirPagoEnLineaCurso(curso.idPrograma);
      Alert.alert('Pago en línea', 'Complete el pago en el navegador y vuelva a la app.');
      onRefresh();
    } catch (e) {
      Alert.alert('Pago', e instanceof Error ? e.message : 'No se pudo iniciar el pago.');
    } finally {
      setPagando(false);
    }
  }

  function onEntrar() {
    const url = resolvePlayerUrl(curso.playerUrl);
    if (!url) {
      irDetalle();
      return;
    }
    nav.navigate('CoursePlayer', {
      idPrograma: String(curso.idPrograma),
      titulo: curso.nombreProg,
      playerUrl: url,
      storagePrefix: curso.storagePrefix ?? undefined,
    });
  }

  return (
    <View style={styles.row}>
      <CursoCard curso={curso} layout="horizontal" onPress={irDetalle} />
      <View style={styles.actions}>
        {mostrarPago ? (
          <PrimaryButton
            label={pagando ? 'Abriendo…' : 'Pagar'}
            onPress={() => void onPagar()}
            loading={pagando}
            icon="card-outline"
            size="md"
          />
        ) : null}
        {puedeEntrar ? (
          <PrimaryButton label="Entrar" onPress={onEntrar} icon="play" size="md" variant={mostrarPago ? 'secondary' : 'primary'} />
        ) : (
          <PrimaryButton label="Ver curso" onPress={irDetalle} icon="open-outline" size="md" variant="secondary" />
        )}
      </View>
      {mostrarPago ? (
        <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: -space.xs, marginBottom: space.sm, paddingHorizontal: space.xs }}>
          Pago pendiente — puede pagar en línea o en el CEA
        </ScaledText>
      ) : null}
    </View>
  );
}

export default function MisCursosPanel() {
  const nav = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<AulaTabParamList, 'MisCursos'>,
      StackNavigationProp<RootStackParamList>
    >
  >();
  const c = useTheme();
  const { pasarelaActiva } = usePasarelaActiva();
  const { cursos, loading, error, reload } = useMisCursos();

  return (
    <ScreenBody onRefresh={reload} refreshing={loading}>
      <SectionHeader
        title="Mis cursos"
        subtitle={`${cursos.length} matriculado(s)`}
        icon="book-outline"
      />
      {error ? (
        <SurfaceCard style={{ marginBottom: space.md }}>
          <ScaledText baseSize={14} style={{ color: c.danger, marginBottom: space.sm }}>
            {error}
          </ScaledText>
          <PrimaryButton label="Reintentar" onPress={() => void reload()} variant="secondary" />
        </SurfaceCard>
      ) : null}
      {!loading && cursos.length === 0 ? (
        <>
          <EmptyState title="Sin cursos matriculados" subtitle="Explore la tienda y matricúlese en un programa" icon="book-outline" />
          <PrimaryButton label="Ver todos los cursos" onPress={() => nav.navigate('Cursos')} icon="library-outline" fullWidth />
        </>
      ) : (
        cursos.map((curso) => (
          <CursoMatriculadoRow
            key={String(curso.idPrograma)}
            curso={curso}
            pasarelaActiva={pasarelaActiva}
            onRefresh={() => void reload()}
          />
        ))
      )}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: space.xs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: -space.xs,
    marginBottom: space.md,
    paddingHorizontal: space.xs,
  },
});
