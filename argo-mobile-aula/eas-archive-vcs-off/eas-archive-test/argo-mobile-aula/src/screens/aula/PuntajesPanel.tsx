import React from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ScaledText } from '../../components/ScaledText';
import { ScreenBody } from '../../components/ScreenBody';
import { SurfaceCard } from '../../components/SurfaceCard';
import { useTheme } from '../../context/ThemeContext';
import { useMisCursos } from '../../hooks/useMisCursos';
import { pctCurso } from '../../utils/cursoUtils';
import { radius, space } from '../../theme/spacing';

export default function PuntajesPanel() {
  const c = useTheme();
  const { cursos, loading, reload } = useMisCursos();

  const conProgreso = cursos.filter((x) => pctCurso(x) > 0 || (x.progreso?.mejorNotaEval ?? null) != null);

  return (
    <ScreenBody onRefresh={reload} refreshing={loading}>
      <View style={[styles.banner, { backgroundColor: c.violetSoft, borderColor: c.border }]}>
        <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800' }}>
          Mis puntajes
        </ScaledText>
        <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 4 }}>
          Avance y evaluaciones de tus cursos
        </ScaledText>
      </View>

      {!loading && conProgreso.length === 0 ? (
        <EmptyState title="Sin puntajes aún" subtitle="Avanza en un curso para ver tus notas" icon="stats-chart-outline" />
      ) : (
        conProgreso.map((curso, idx) => {
          const tint = idx % 2 === 0 ? c.violetSoft : c.accentSoft;
          const accent = idx % 2 === 0 ? c.violet : c.accent;
          return (
            <SurfaceCard key={String(curso.idPrograma)} style={{ marginBottom: space.md }} tint={tint} accentLeft={accent}>
              <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700' }}>
                {curso.nombreProg}
              </ScaledText>
              <View style={styles.grid}>
                <Metric
                  label="Completitud"
                  value={`${Math.round(pctCurso(curso))}%`}
                  bg={c.accentSoft}
                  color={c.primary}
                />
                <Metric
                  label="Mejor nota"
                  value={curso.progreso?.mejorNotaEval != null ? String(curso.progreso.mejorNotaEval) : '—'}
                  bg={c.violetSoft}
                  color={c.violet}
                />
                <Metric
                  label="Intentos"
                  value={String(curso.progreso?.intentosEval ?? 0)}
                  bg={c.foroSoft}
                  color={c.accent}
                />
                <Metric
                  label="Aprobado"
                  value={curso.progreso?.aprobado ? 'Sí' : 'No'}
                  bg={curso.progreso?.aprobado ? c.okSoft : c.warnSoft}
                  color={curso.progreso?.aprobado ? c.ok : c.warn}
                />
              </View>
              {curso.progreso?.clases?.length ? (
                <View style={[styles.clasesBox, { backgroundColor: `${accent}18` }]}>
                  {curso.progreso.clases.map((cl) => (
                    <ScaledText key={cl.numero} baseSize={12} style={{ color: c.text, marginTop: 2 }}>
                      Clase {cl.numero}: {Math.round(cl.pct)}% {cl.aprobada ? '✓' : ''}
                    </ScaledText>
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          );
        })
      )}
    </ScreenBody>
  );
}

function Metric({ label, value, bg, color }: { label: string; value: string; bg: string; color: string }) {
  return (
    <View style={[styles.metric, { backgroundColor: bg }]}>
      <ScaledText baseSize={11} style={{ color: color, fontWeight: '600', opacity: 0.85 }}>
        {label}
      </ScaledText>
      <ScaledText baseSize={16} style={{ color: color, fontWeight: '800', marginTop: 2 }}>
        {value}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    borderWidth: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, gap: space.sm },
  metric: {
    width: '47%',
    borderRadius: radius.md,
    padding: space.md,
  },
  clasesBox: {
    marginTop: space.md,
    borderRadius: radius.md,
    padding: space.md,
  },
});
