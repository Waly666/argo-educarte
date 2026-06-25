import React from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ScaledText } from './ScaledText';
import { MoneyText } from './MoneyText';
import { PrimaryButton } from './PrimaryButton';
import type { ServicioItem } from '../api/domain';
import { etiquetaSemestre } from '../utils/cuotasSemestre';

type ThemeColors = ReturnType<typeof import('../theme/colors').themeColors>;

type Props = {
  c: ThemeColors;
  serviciosProg: ServicioItem[];
  valorMatriculaBase: number;
  totalExtrasMatricula: number;
  numCuotasSemestre: number;
  cuotasCatalogo: number[];
  permitirRebaja: boolean;
  permitirCuotas: boolean;
  esTarifaVirtual: boolean;
  ajustarValorMat: boolean;
  onAjustarValorMatChange: (v: boolean) => void;
  valorAcordadoMat: string;
  onValorAcordadoMatChange: (v: string) => void;
  motivoAjusteMat: string;
  onMotivoAjusteMatChange: (v: string) => void;
  rebajaMatricula: number;
  ajustarCuotasSemestre: boolean;
  onAjustarCuotasSemestreChange: (v: boolean) => void;
  valoresCuotasSemestre: (number | null)[];
  onCuotaSemestreChange: (index: number, raw: string) => void;
  motivoAjusteCuotas: string;
  onMotivoAjusteCuotasChange: (v: string) => void;
  totalCuotasSemestre: number;
  onRepartirEquitativo: () => void;
  onRestaurarCatalogo: () => void;
  cuotaSemestreInvalida: (index: number) => boolean;
};

export function MatriculaAjustePanel({
  c,
  serviciosProg,
  valorMatriculaBase,
  totalExtrasMatricula,
  numCuotasSemestre,
  cuotasCatalogo,
  permitirRebaja,
  permitirCuotas,
  esTarifaVirtual,
  ajustarValorMat,
  onAjustarValorMatChange,
  valorAcordadoMat,
  onValorAcordadoMatChange,
  motivoAjusteMat,
  onMotivoAjusteMatChange,
  rebajaMatricula,
  ajustarCuotasSemestre,
  onAjustarCuotasSemestreChange,
  valoresCuotasSemestre,
  onCuotaSemestreChange,
  motivoAjusteCuotas,
  onMotivoAjusteCuotasChange,
  totalCuotasSemestre,
  onRepartirEquitativo,
  onRestaurarCatalogo,
  cuotaSemestreInvalida,
}: Props) {
  const puedeRebaja = permitirRebaja && !esTarifaVirtual && valorMatriculaBase > 0 && !ajustarCuotasSemestre;
  const puedeCuotas = permitirCuotas && !esTarifaVirtual && numCuotasSemestre >= 2;

  if (!puedeRebaja && !puedeCuotas) return null;

  return (
    <View style={styles.wrap}>
      {puedeRebaja ? (
        <View style={[styles.block, { borderColor: c.border, backgroundColor: c.bgAlt }]}>
          <View style={styles.switchRow}>
            <Switch
              value={ajustarValorMat}
              onValueChange={onAjustarValorMatChange}
              trackColor={{ false: '#cbd5e1', true: c.primary }}
            />
            <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700', flex: 1 }}>
              Ajustar valor (solo rebaja)
            </ScaledText>
          </View>
          {ajustarValorMat ? (
            <View style={{ gap: 10, marginTop: 10 }}>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 4 }}>
                    Valor catálogo
                  </ScaledText>
                  <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700' }}>
                    {valorMatriculaBase.toLocaleString('es-CO')}
                  </ScaledText>
                </View>
                <View style={{ flex: 1 }}>
                  <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 4 }}>
                    Valor a cobrar
                  </ScaledText>
                  <TextInput
                    value={valorAcordadoMat}
                    onChangeText={onValorAcordadoMatChange}
                    keyboardType="number-pad"
                    placeholder={String(valorMatriculaBase)}
                    placeholderTextColor="#94a3b8"
                    style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                  />
                </View>
              </View>
              <View>
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 4 }}>
                  Motivo de la rebaja *
                </ScaledText>
                <TextInput
                  value={motivoAjusteMat}
                  onChangeText={onMotivoAjusteMatChange}
                  placeholder="Ej. convenio empresa, beca parcial…"
                  placeholderTextColor="#94a3b8"
                  maxLength={300}
                  style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                />
              </View>
              {rebajaMatricula > 0 || totalExtrasMatricula > 0 ? (
                <ScaledText baseSize={12} style={{ color: c.textSoft, lineHeight: 18 }}>
                  {rebajaMatricula > 0 ? `Rebaja: ${rebajaMatricula.toLocaleString('es-CO')}` : ''}
                  {rebajaMatricula > 0 && totalExtrasMatricula > 0 ? ' · ' : ''}
                  {totalExtrasMatricula > 0
                    ? `Extras: ${totalExtrasMatricula.toLocaleString('es-CO')}`
                    : ''}
                </ScaledText>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {puedeCuotas ? (
        <View style={[styles.block, { borderColor: c.border, backgroundColor: c.bgAlt }]}>
          <View style={styles.switchRow}>
            <Switch
              value={ajustarCuotasSemestre}
              onValueChange={onAjustarCuotasSemestreChange}
              trackColor={{ false: '#cbd5e1', true: c.primary }}
            />
            <View style={{ flex: 1 }}>
              <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '700' }}>
                Personalizar cuotas por semestre
              </ScaledText>
              <ScaledText baseSize={11} style={{ color: c.textSoft, marginTop: 2 }}>
                Presencial / mixta · {numCuotasSemestre} cuota(s)
              </ScaledText>
            </View>
          </View>

          {ajustarCuotasSemestre ? (
            <View style={{ gap: 10, marginTop: 10 }}>
              <View style={styles.toolbar}>
                <PrimaryButton
                  label="Repartir equitativo"
                  variant="ghost"
                  onPress={onRepartirEquitativo}
                  style={{ flex: 1 }}
                />
                <PrimaryButton
                  label="Restaurar catálogo"
                  variant="ghost"
                  onPress={onRestaurarCatalogo}
                  style={{ flex: 1 }}
                />
              </View>
              {valoresCuotasSemestre.map((v, i) => (
                <View
                  key={i}
                  style={[
                    styles.cuotaCard,
                    {
                      borderColor: cuotaSemestreInvalida(i) ? c.danger : c.border,
                      backgroundColor: c.card,
                    },
                  ]}
                >
                  <ScaledText baseSize={12} style={{ color: c.primary, fontWeight: '700' }}>
                    Sem. {i + 1}
                  </ScaledText>
                  <ScaledText baseSize={13} style={{ color: c.text, marginVertical: 4 }} numberOfLines={2}>
                    {etiquetaSemestre(serviciosProg, i)}
                  </ScaledText>
                  <ScaledText baseSize={11} style={{ color: c.textSoft }}>
                    Catálogo: {(cuotasCatalogo[i] ?? 0).toLocaleString('es-CO')}
                  </ScaledText>
                  <TextInput
                    value={v != null ? String(v) : ''}
                    onChangeText={(t) => onCuotaSemestreChange(i, t)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    style={[
                      styles.input,
                      { borderColor: c.border, color: c.text, backgroundColor: c.bgAlt, marginTop: 6 },
                    ]}
                  />
                </View>
              ))}
              <View style={styles.totalRow}>
                <ScaledText baseSize={13} style={{ color: c.textSoft }}>
                  Total matrícula (cuotas)
                </ScaledText>
                <MoneyText value={totalCuotasSemestre} baseSize={16} style={{ color: c.primary }} bold />
              </View>
              <View>
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 4 }}>
                  Motivo (opcional)
                </ScaledText>
                <TextInput
                  value={motivoAjusteCuotas}
                  onChangeText={onMotivoAjusteCuotasChange}
                  placeholder="Ej. precios distintos por semestre…"
                  placeholderTextColor="#94a3b8"
                  maxLength={300}
                  style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.card }]}
                />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 4 },
  block: { borderWidth: 1, borderRadius: 12, padding: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row2: { flexDirection: 'row', gap: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  toolbar: { flexDirection: 'row', gap: 8 },
  cuotaCard: { borderWidth: 1, borderRadius: 10, padding: 10 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
