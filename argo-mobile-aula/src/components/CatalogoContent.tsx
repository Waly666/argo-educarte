import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { CursoCard } from './CursoCard';
import { EmptyState } from './EmptyState';
import { FilterChip } from './FilterChip';
import { ScaledText } from './ScaledText';
import { SearchField } from './SearchField';
import { SectionHeader } from './SectionHeader';
import { SurfaceCard } from './SurfaceCard';
import { useTheme } from '../context/ThemeContext';
import { useDebounced } from '../hooks/useDebounced';
import { fetchCategorias, fetchCursos } from '../api/aulaApi';
import type { CategoriaVirtual, CursoVirtual } from '../api/types';
import type { RootStackParamList } from '../navigation/types';
import { space } from '../theme/spacing';

type Props = {
  intro?: string;
};

export function CatalogoContent({ intro }: Props) {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const c = useTheme();
  const [q, setQ] = useState('');
  const qDeb = useDebounced(q);
  const [cats, setCats] = useState<CategoriaVirtual[]>([]);
  const [catId, setCatId] = useState<number | null>(null);
  const [cursos, setCursos] = useState<CursoVirtual[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const categorias = await fetchCategorias();
        if (!cancelled) setCats(categorias);
      } catch {
        if (!cancelled) setCats([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCursos = useCallback(async () => {
    try {
      const rows = await fetchCursos(qDeb, catId);
      setCursos(Array.isArray(rows) ? rows : []);
    } catch {
      setCursos([]);
    }
  }, [qDeb, catId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await loadCursos();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCursos]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const [categorias] = await Promise.all([fetchCategorias(), loadCursos()]);
      setCats(categorias);
    } catch {
      setCats([]);
      await loadCursos();
    } finally {
      setRefreshing(false);
    }
  }

  function abrirCurso(curso: CursoVirtual) {
    nav.navigate('CursoDetalle', { id: String(curso.idPrograma), titulo: curso.nombreProg });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />
      }
    >
      <SectionHeader
        title="Cursos"
        subtitle={loading && !refreshing ? 'Cargando…' : `${cursos.length} programa(s) disponibles`}
        icon="library-outline"
      />
      <SurfaceCard padding="md" style={{ marginBottom: space.md }} tint={c.accentSoft} accentLeft={c.accent}>
        <ScaledText baseSize={13} style={{ color: c.textSoft, lineHeight: 20 }}>
          {intro ??
            'La mayoría de cursos son gratuitos: matricúlese y estudie sin pagar. El valor del programa aplica cuando necesita el certificado.'}
        </ScaledText>
      </SurfaceCard>
      <SearchField value={q} onChangeText={setQ} placeholder="Buscar curso…" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} nestedScrollEnabled>
        <FilterChip label="Todos" active={catId == null} onPress={() => setCatId(null)} />
        {cats.map((cat) => (
          <FilterChip
            key={cat.idCategoria}
            label={cat.nombre}
            active={catId === cat.idCategoria}
            onPress={() => setCatId(cat.idCategoria)}
          />
        ))}
      </ScrollView>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginVertical: space.xxl }} color={c.primary} size="large" />
      ) : cursos.length === 0 ? (
        <EmptyState title="Sin resultados" subtitle="Prueba otra búsqueda o categoría" icon="search-outline" />
      ) : (
        <View style={styles.list}>
          {cursos.map((curso) => (
            <CursoCard key={String(curso.idPrograma)} curso={curso} onPress={() => abrirCurso(curso)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  chips: { paddingBottom: space.md },
  list: { paddingTop: space.sm },
});
