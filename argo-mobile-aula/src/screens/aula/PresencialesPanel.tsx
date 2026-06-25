import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScaledText } from '../../components/ScaledText';
import { ScreenBody } from '../../components/ScreenBody';
import { SurfaceCard } from '../../components/SurfaceCard';
import { useTheme } from '../../context/ThemeContext';
import {
  asistirMeet,
  fetchCalendarioCohorte,
  fetchEvaluacionesCohorte,
  fetchMaterialesCohorte,
  fetchMisClasesPresenciales,
} from '../../api/aulaApi';
import type { CalendarioCohorte, CohorteAlumno, EvaluacionCohorteAlumno, MaterialCohorteAlumno } from '../../api/types';
import type { RootStackParamList } from '../../navigation/types';
import { fmtFecha } from '../../utils/cursoUtils';

export default function PresencialesPanel() {
  const c = useTheme();
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [cohortes, setCohortes] = useState<CohorteAlumno[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [cal, setCal] = useState<CalendarioCohorte | null>(null);
  const [evals, setEvals] = useState<EvaluacionCohorteAlumno[]>([]);
  const [mats, setMats] = useState<MaterialCohorteAlumno[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await fetchMisClasesPresenciales();
      setCohortes(rows);
      if (rows.length && !sel) setSel(rows[0].idCohorte);
    } catch {
      setCohortes([]);
    }
  }, [sel]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sel) return;
    void (async () => {
      try {
        const [cCal, cEv, cMat] = await Promise.all([
          fetchCalendarioCohorte(sel),
          fetchEvaluacionesCohorte(sel),
          fetchMaterialesCohorte(sel),
        ]);
        setCal(cCal);
        setEvals(cEv);
        setMats(cMat);
      } catch {
        setCal(null);
        setEvals([]);
        setMats([]);
      }
    })();
  }, [sel]);

  async function onMeet(idClase: string, url?: string) {
    try {
      await asistirMeet(idClase);
      if (url) await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Clase', e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <ScreenBody onRefresh={load}>
      <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800', marginBottom: 12 }}>
        Clases presenciales
      </ScaledText>
      {cohortes.length === 0 ? (
        <EmptyState title="Sin cohortes presenciales" icon="people-outline" />
      ) : (
        <>
          <View style={styles.chips}>
            {cohortes.map((ch) => (
              <Pressable
                key={ch.idCohorte}
                onPress={() => setSel(ch.idCohorte)}
                style={[
                  styles.chip,
                  { backgroundColor: sel === ch.idCohorte ? c.primary : c.card, borderColor: c.border },
                ]}
              >
                <ScaledText baseSize={12} style={{ color: sel === ch.idCohorte ? '#fff' : c.text }}>
                  {ch.cohorteNombre}
                </ScaledText>
              </Pressable>
            ))}
          </View>
          {cal ? (
            <SurfaceCard style={{ marginBottom: 12 }}>
              <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
                Calendario
              </ScaledText>
              {cal.clases.map((cl) => (
                <View key={cl.idClase} style={[styles.row, { borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                      {cl.materiaNombre}
                    </ScaledText>
                    <ScaledText baseSize={12} style={{ color: c.textSoft }}>
                      {fmtFecha(cl.fechaClase)} · Asistencia: {cl.miAsistencia}
                    </ScaledText>
                  </View>
                  {cl.urlMeet ? (
                    <PrimaryButton
                      label="Meet"
                      onPress={() => void onMeet(cl.idClase, cl.urlMeet)}
                      icon="videocam-outline"
                    />
                  ) : null}
                </View>
              ))}
            </SurfaceCard>
          ) : null}
          {evals.length > 0 ? (
            <SurfaceCard style={{ marginBottom: 12 }}>
              <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
                Evaluaciones
              </ScaledText>
              {evals.map((ev) => (
                <View key={ev.idEvaluacion} style={[styles.row, { borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600' }}>
                      {ev.titulo}
                    </ScaledText>
                    <ScaledText baseSize={12} style={{ color: c.textSoft }}>
                      {ev.materiaNombre} · Mejor nota: {ev.miMejorNota ?? '—'}
                    </ScaledText>
                  </View>
                  {ev.puedeIniciar ? (
                    <PrimaryButton
                      label="Iniciar"
                      onPress={() =>
                        nav.navigate('EvaluacionCohorte', {
                          idEval: ev.idEvaluacion,
                          idCohorte: sel!,
                          titulo: ev.titulo,
                        })
                      }
                    />
                  ) : null}
                </View>
              ))}
            </SurfaceCard>
          ) : null}
          {mats.length > 0 ? (
            <SurfaceCard>
              <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
                Materiales
              </ScaledText>
              {mats.map((m) => (
                <Pressable
                  key={m._id}
                  onPress={() => m.url && void Linking.openURL(m.url)}
                  style={styles.matRow}
                >
                  <Ionicons name="document-outline" size={18} color={c.primary} />
                  <ScaledText baseSize={14} style={{ color: c.primary, marginLeft: 8, flex: 1 }}>
                    {m.titulo}
                  </ScaledText>
                </Pressable>
              ))}
            </SurfaceCard>
          ) : null}
        </>
      )}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
    gap: 8,
  },
  matRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});
