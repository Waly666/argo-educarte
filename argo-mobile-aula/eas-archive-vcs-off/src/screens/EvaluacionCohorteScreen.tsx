import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';

import { PrimaryButton } from '../components/PrimaryButton';
import { ScaledText } from '../components/ScaledText';
import { SurfaceCard } from '../components/SurfaceCard';
import { useTheme } from '../context/ThemeContext';
import { enviarIntentoCohorte, iniciarIntentoCohorte } from '../api/aulaApi';
import type { IntentoEvalCohorte, PreguntaEvalAlumno } from '../api/types';
import type { RootStackParamList } from '../navigation/types';

export default function EvaluacionCohorteScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'EvaluacionCohorte'>>();
  const c = useTheme();
  const [intento, setIntento] = useState<IntentoEvalCohorte | null>(null);
  const [loading, setLoading] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, number[]>>({});
  const [resultado, setResultado] = useState<string | null>(null);

  async function onIniciar() {
    setLoading(true);
    try {
      const row = await iniciarIntentoCohorte(route.params.idEval);
      setIntento(row);
      setRespuestas({});
      setResultado(null);
    } catch (e) {
      Alert.alert('Evaluación', e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  function toggle(p: PreguntaEvalAlumno, idx: number) {
    setRespuestas((prev) => {
      const cur = prev[p.idPregunta] ?? [];
      if (p.tipo === 'MULTIPLE') {
        const next = cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx];
        return { ...prev, [p.idPregunta]: next };
      }
      return { ...prev, [p.idPregunta]: [idx] };
    });
  }

  async function onEnviar() {
    if (!intento) return;
    setLoading(true);
    try {
      const payload = intento.preguntas.map((p) => ({
        idPregunta: p.idPregunta,
        seleccion: respuestas[p.idPregunta] ?? [],
      }));
      const res = await enviarIntentoCohorte(route.params.idEval, payload);
      setResultado(
        `Nota: ${res.nota} · ${res.aprobado ? 'Aprobado' : 'No aprobado'} (${res.puntajeObtenido}/${res.puntajeTotal})`,
      );
    } catch (e) {
      Alert.alert('Evaluación', e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  if (!intento) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>
          {route.params.titulo}
        </ScaledText>
        <PrimaryButton label="Iniciar evaluación" onPress={onIniciar} loading={loading} icon="play-outline" />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.pad}>
      {resultado ? (
        <SurfaceCard style={{ marginBottom: 16 }}>
          <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700' }}>
            {resultado}
          </ScaledText>
        </SurfaceCard>
      ) : null}
      {intento.preguntas.map((p, pi) => (
        <SurfaceCard key={p.idPregunta} style={{ marginBottom: 12 }}>
          <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
            {pi + 1}. {p.enunciado}
          </ScaledText>
          {p.opciones.map((op, oi) => {
            const sel = (respuestas[p.idPregunta] ?? []).includes(oi);
            return (
              <Pressable
                key={oi}
                onPress={() => toggle(p, oi)}
                style={[styles.opt, { borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.accentSoft : c.card }]}
              >
                <ScaledText baseSize={14} style={{ color: c.text }}>
                  {op.texto}
                </ScaledText>
              </Pressable>
            );
          })}
        </SurfaceCard>
      ))}
      {!resultado ? (
        <PrimaryButton label="Enviar respuestas" onPress={onEnviar} loading={loading} fullWidth />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pad: { padding: 16, paddingBottom: 32 },
  opt: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
});
