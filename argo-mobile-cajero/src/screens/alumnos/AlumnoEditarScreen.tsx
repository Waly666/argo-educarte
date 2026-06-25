import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View, StyleSheet } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { ScreenBody } from '../../components/ScreenBody';
import { AlumnoFormulario, type AlumnoFormGuardado } from '../../components/AlumnoFormulario';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { fetchAlumnoPorDoc, fetchAlumnoPorId } from '../../api/alumnosApi';
import type { AlumnoDetalleItem } from '../../api/domain';
import type { RootStackParamList } from '../../navigation/types';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';
import { nombreCompleto } from '../../utils/format';

export default function AlumnoEditarScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AlumnoEditar'>>();
  const { alumnoId, numDoc } = route.params;
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [alumno, setAlumno] = useState<AlumnoDetalleItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let data: AlumnoDetalleItem;
        if (alumnoId) {
          data = await fetchAlumnoPorId(alumnoId);
        } else {
          data = await fetchAlumnoPorDoc(numDoc);
        }
        if (!cancel) setAlumno(data);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : 'No se pudo cargar el alumno');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [alumnoId, numDoc]);

  function onGuardado({ nombre }: AlumnoFormGuardado) {
    Alert.alert('Datos actualizados', `${nombre}`, [{ text: 'OK', onPress: () => nav.goBack() }]);
  }

  const titulo = alumno ? nombreCompleto(alumno) : route.params.nombre;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenBody>
        <SurfaceCard style={styles.hero} elevated>
          <View style={[styles.heroIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="create-outline" size={28} color={c.primary} />
          </View>
          <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800' }}>
            Editar alumno
          </ScaledText>
          <ScaledText baseSize={14} style={{ color: c.textSoft, marginTop: 6, lineHeight: 20 }}>
            {titulo} · Doc. {numDoc}
          </ScaledText>
        </SurfaceCard>

        {loading ? (
          <SurfaceCard>
            <ScaledText baseSize={14} style={{ color: c.textSoft }}>Cargando datos…</ScaledText>
          </SurfaceCard>
        ) : null}

        {error ? (
          <SurfaceCard elevated={false} style={{ padding: 12, backgroundColor: c.warnBg }}>
            <ScaledText baseSize={14} style={{ color: c.warn }}>{error}</ScaledText>
          </SurfaceCard>
        ) : null}

        {alumno && !loading ? (
          <AlumnoFormulario
            mode="edit"
            alumnoId={alumno._id}
            initial={alumno}
            onGuardado={onGuardado}
            onCancelar={() => nav.goBack()}
          />
        ) : null}
      </ScreenBody>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 16, alignItems: 'flex-start' },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
