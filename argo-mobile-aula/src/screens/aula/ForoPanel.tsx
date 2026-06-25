import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChip } from '../../components/FilterChip';
import { ForoChat } from '../../components/ForoChat';
import { EmptyState } from '../../components/EmptyState';
import { ScaledText } from '../../components/ScaledText';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMisCursos } from '../../hooks/useMisCursos';
import { radius, space } from '../../theme/spacing';

function ForoHeader({ insetsTop = 0 }: { insetsTop?: number }) {
  const c = useTheme();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insetsTop + space.md,
          backgroundColor: c.headerBg,
          borderBottomColor: c.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.headerIcon, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="chatbubbles" size={22} color={c.primary} />
        </View>
        <View>
          <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800' }}>
            Foro de cursos
          </ScaledText>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 4 }}>
            Preguntas y discusión con instructores
          </ScaledText>
        </View>
      </View>
    </View>
  );
}

export default function ForoPanel() {
  const { state } = useAuth();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { cursos } = useMisCursos();
  const [sel, setSel] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    if (cursos.length && !sel) {
      setSel(String(cursos[0].idPrograma));
      setNombre(cursos[0].nombreProg);
    }
  }, [cursos, sel]);

  const token = state.status === 'signedIn' ? state.token : null;

  if (cursos.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: c.bg }]}>
        <ForoHeader insetsTop={insets.top} />
        <EmptyState
          title="Sin cursos para el foro"
          subtitle="Matricúlese en un curso para participar"
          icon="chatbubbles-outline"
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ForoHeader insetsTop={insets.top} />
      <View style={[styles.chipsWrap, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View style={styles.chips}>
          {cursos.map((curso) => {
            const id = String(curso.idPrograma);
            const active = sel === id;
            return (
              <FilterChip
                key={id}
                label={curso.nombreProg.length > 22 ? `${curso.nombreProg.slice(0, 20)}…` : curso.nombreProg}
                active={active}
                onPress={() => {
                  setSel(id);
                  setNombre(curso.nombreProg);
                }}
              />
            );
          })}
        </View>
      </View>
      {sel ? (
        <View style={{ flex: 1, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <ForoChat token={token} idPrograma={sel} nombreCurso={nombre} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    marginBottom: space.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
