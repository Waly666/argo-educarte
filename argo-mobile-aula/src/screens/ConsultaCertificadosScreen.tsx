import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { IconInput } from '../components/IconInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScaledText } from '../components/ScaledText';
import { ScreenBody } from '../components/ScreenBody';
import { SurfaceCard } from '../components/SurfaceCard';
import { useTheme } from '../context/ThemeContext';
import { consultarCertificados } from '../api/aulaApi';
import type { CertificadoConsultaRes } from '../api/types';
import { fmtFecha } from '../utils/cursoUtils';

export default function ConsultaCertificadosScreen() {
  const c = useTheme();
  const [doc, setDoc] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<CertificadoConsultaRes | null>(null);

  async function onBuscar() {
    if (!doc.trim()) {
      Alert.alert('Consulta', 'Ingrese el número de documento');
      return;
    }
    setLoading(true);
    try {
      const data = await consultarCertificados(doc.trim());
      setRes(data);
    } catch (e) {
      Alert.alert('Consulta', e instanceof Error ? e.message : 'Error');
      setRes(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBody>
      <ScaledText baseSize={16} style={{ color: c.textSoft, marginBottom: 16 }}>
        Consulte certificados emitidos por documento de identidad.
      </ScaledText>
      <IconInput
        value={doc}
        onChangeText={setDoc}
        placeholder="Número de documento"
        icon="card-outline"
        keyboardType="numeric"
      />
      <PrimaryButton label="Buscar" onPress={onBuscar} loading={loading} fullWidth icon="search-outline" />
      {res ? (
        <SurfaceCard style={{ marginTop: 20 }}>
          <ScaledText baseSize={17} style={{ color: c.text, fontWeight: '800' }}>
            {res.nombreApellidos}
          </ScaledText>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginBottom: 12 }}>
            Documento: {res.cedula} · {res.total} certificado(s)
          </ScaledText>
          {res.items.map((it) => (
            <View key={it.idCertificado} style={[styles.item, { borderColor: c.border }]}>
              <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700' }}>
                {it.encabezado}
              </ScaledText>
              <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 4 }}>
                Horas: {it.horas}
              </ScaledText>
              <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 2 }}>
                Emisión: {fmtFecha(it.fechaCert)} · Vence: {fmtFecha(it.fechaVence)}
              </ScaledText>
            </View>
          ))}
        </SurfaceCard>
      ) : null}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  item: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
});
