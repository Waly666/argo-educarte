import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from './PrimaryButton';
import { ScaledText } from './ScaledText';
import { useTheme } from '../context/ThemeContext';
import type { CursoVirtual, EstadoInscripcionVirtual } from '../api/types';
import { hintMatricula, hintMatriculado, hintPagoEnLinea } from '../utils/cursoPrecio';
import {
  abrirPagoEnLineaCurso,
  modoPagoInscripcion,
  puedeMostrarPagoEnLinea,
} from '../utils/pagoVirtual';
import { shadow } from '../theme/shadows';
import { space } from '../theme/spacing';

type Props = {
  curso: CursoVirtual;
  inscripcion?: EstadoInscripcionVirtual | null;
  signedIn: boolean;
  pasarelaActiva: boolean;
  puedeEntrar: boolean;
  matriculado: boolean;
  busyMatricula: boolean;
  onMatricular: () => void;
  onContinuar: () => void;
  onRegistro: () => void;
  onLogin: () => void;
  onPagoIniciado?: () => void;
  compact?: boolean;
};

/** Botones de matrícula, acceso y pago — siempre visibles. */
export function CursoAcciones({
  curso,
  inscripcion,
  signedIn,
  pasarelaActiva,
  puedeEntrar,
  matriculado,
  busyMatricula,
  onMatricular,
  onContinuar,
  onRegistro,
  onLogin,
  onPagoIniciado,
  compact,
}: Props) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [pagando, setPagando] = useState(false);

  const ins = inscripcion ?? null;
  const modo = ins ? modoPagoInscripcion(ins, curso) : 'sin_deuda';
  const mostrarPago = ins ? puedeMostrarPagoEnLinea(ins, curso) : false;

  async function onPagarEnLinea() {
    if (pagando) return;
    if (!pasarelaActiva) {
      Alert.alert(
        'Pago en línea',
        'Los pagos en línea no están activos en este momento. Acérquese al CEA para completar el pago.',
      );
      return;
    }
    setPagando(true);
    try {
      await abrirPagoEnLineaCurso(curso.idPrograma);
      onPagoIniciado?.();
      Alert.alert(
        'Pago en línea',
        'Complete el pago en el navegador. Al volver a la app, esta pantalla se actualizará automáticamente.',
      );
    } catch (e) {
      Alert.alert('Pago en línea', e instanceof Error ? e.message : 'No se pudo iniciar el pago.');
    } finally {
      setPagando(false);
    }
  }

  let hint = '';
  if (!signedIn) {
    hint = hintMatricula(curso);
  } else if (matriculado && ins) {
    hint = hintMatriculado(ins, pasarelaActiva);
    if (mostrarPago && modo !== 'pagado') {
      hint = `${hint} ${hintPagoEnLinea(modo === 'bloqueado' ? 'bloqueado' : 'opcional')}`;
    }
  } else {
    hint = hintMatricula(curso);
  }

  return (
    <View
      style={[
        styles.wrap,
        !compact && shadow.lg,
        {
          backgroundColor: c.card,
          borderTopColor: c.border,
          paddingBottom: compact ? 0 : Math.max(insets.bottom, space.md),
        },
      ]}
    >
      {hint ? (
        <ScaledText baseSize={12} style={{ color: c.textSoft, textAlign: 'center', lineHeight: 18, marginBottom: space.sm }}>
          {hint}
        </ScaledText>
      ) : null}

      {!signedIn ? (
        <View style={styles.stack}>
          <PrimaryButton label="Registrarse e inscribirse" onPress={onRegistro} fullWidth size="lg" icon="person-add-outline" />
          <PrimaryButton label="Ya tengo cuenta" variant="ghost" onPress={onLogin} fullWidth />
        </View>
      ) : !matriculado ? (
        <PrimaryButton
          label="Matricularme"
          onPress={onMatricular}
          loading={busyMatricula}
          icon="school-outline"
          fullWidth
          size="lg"
        />
      ) : (
        <View style={styles.stack}>
          {mostrarPago ? (
            <PrimaryButton
              label={pagando ? 'Abriendo pasarela…' : 'Pagar curso en línea'}
              onPress={() => void onPagarEnLinea()}
              loading={pagando}
              icon="card-outline"
              fullWidth
              size="lg"
            />
          ) : null}
          {puedeEntrar ? (
            <PrimaryButton
              label="Entrar al curso"
              onPress={onContinuar}
              icon="play"
              fullWidth
              size="lg"
              variant={mostrarPago ? 'secondary' : 'primary'}
            />
          ) : null}
          {matriculado && !puedeEntrar && !mostrarPago ? (
            <PrimaryButton
              label="Ver estado de matrícula"
              onPress={() =>
                Alert.alert(
                  'Matrícula',
                  ins ? hintMatriculado(ins, pasarelaActiva) : 'Consulte con el CEA el estado de su matrícula.',
                )
              }
              variant="secondary"
              fullWidth
              icon="information-circle-outline"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  stack: { gap: space.sm },
});
