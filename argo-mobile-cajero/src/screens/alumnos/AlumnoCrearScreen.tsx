import React from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { ScreenBody } from '../../components/ScreenBody';
import { AlumnoFormulario, type AlumnoFormGuardado } from '../../components/AlumnoFormulario';
import { SurfaceCard } from '../../components/SurfaceCard';
import { ScaledText } from '../../components/ScaledText';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';
import { useAccessibility } from '../../context/AccessibilityContext';
import { themeColors } from '../../theme/colors';

export default function AlumnoCrearScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  function onGuardado({ alumno, nombre }: AlumnoFormGuardado) {
    Alert.alert('Alumno registrado', `${nombre}\nDocumento ${alumno.numDoc}`, [
      { text: 'Volver a lista', style: 'cancel', onPress: () => nav.goBack() },
      {
        text: 'Ir a ficha',
        onPress: () =>
          nav.replace('AlumnoDetalle', {
            numDoc: String(alumno.numDoc),
            nombre,
            alumnoId: alumno._id,
          }),
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenBody>
        <SurfaceCard style={styles.hero} elevated>
          <View style={[styles.heroIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="person-add-outline" size={28} color={c.primary} />
          </View>
          <ScaledText baseSize={20} style={{ color: c.text, fontWeight: '800' }}>Nuevo alumno</ScaledText>
          <ScaledText baseSize={14} style={{ color: c.textSoft, marginTop: 6, lineHeight: 20 }}>
            Mismos datos que en el ERP: identificación, personales, contacto, recordatorio de cobro, diversidad y empresa.
          </ScaledText>
        </SurfaceCard>

        <AlumnoFormulario onGuardado={onGuardado} onCancelar={() => nav.goBack()} />
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
