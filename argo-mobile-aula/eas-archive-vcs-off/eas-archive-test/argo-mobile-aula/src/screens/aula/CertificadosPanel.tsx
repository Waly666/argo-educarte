import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '../../components/EmptyState';
import { ScaledText } from '../../components/ScaledText';
import { ScreenBody } from '../../components/ScreenBody';
import { SectionHeader } from '../../components/SectionHeader';
import { SurfaceCard } from '../../components/SurfaceCard';
import { useTheme } from '../../context/ThemeContext';
import { certificadoHtmlPath, fetchMisCertificados, reciboHtmlPath } from '../../api/aulaApi';
import type { CertificadoPortal } from '../../api/types';
import { fmtFecha } from '../../utils/cursoUtils';
import type { RootStackParamList } from '../../navigation/types';
import { radius, space } from '../../theme/spacing';

export default function CertificadosPanel() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const c = useTheme();
  const [certs, setCerts] = useState<CertificadoPortal[]>([]);

  const load = useCallback(async () => {
    try {
      setCerts(await fetchMisCertificados());
    } catch {
      setCerts([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function titulo(cert: CertificadoPortal) {
    return cert.encabezado || cert.nomCert || cert.programaDescr || 'Certificado';
  }

  return (
    <ScreenBody onRefresh={load}>
      <View style={[styles.banner, { backgroundColor: c.goldSoft, borderColor: c.border }]}>
        <Ionicons name="ribbon" size={28} color={c.gold} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <ScaledText baseSize={18} style={{ color: c.text, fontWeight: '800' }}>
            Mis certificados
          </ScaledText>
          <ScaledText baseSize={13} style={{ color: c.textSoft, marginTop: 2 }}>
            {certs.length} emitido(s)
          </ScaledText>
        </View>
      </View>

      {certs.length === 0 ? (
        <EmptyState title="Sin certificados" subtitle="Complete cursos para obtener certificados" icon="ribbon-outline" />
      ) : (
        certs.map((cert) => (
          <SurfaceCard key={cert._id} style={{ marginBottom: space.md }} tint={c.goldSoft} accentLeft={c.gold}>
            <View style={styles.certHead}>
              <View style={[styles.certIcon, { backgroundColor: `${c.gold}33` }]}>
                <Ionicons name="medal-outline" size={22} color={c.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '700' }}>
                  {titulo(cert)}
                </ScaledText>
                <ScaledText baseSize={12} style={{ color: c.textSoft, marginTop: 4 }}>
                  {cert.codigoCert ? `Código: ${cert.codigoCert} · ` : ''}
                  Emisión: {fmtFecha(cert.fechaEmision)}
                </ScaledText>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  nav.navigate('DocumentoHtml', {
                    title: titulo(cert),
                    htmlPath: certificadoHtmlPath(cert._id),
                  })
                }
                style={[styles.btn, { backgroundColor: c.primary }]}
              >
                <Ionicons name="document-text-outline" size={16} color="#fff" />
                <ScaledText baseSize={13} style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>
                  Ver certificado
                </ScaledText>
              </Pressable>
              {cert.recibo?.idIngreso ? (
                <Pressable
                  onPress={() =>
                    nav.navigate('DocumentoHtml', {
                      title: `Recibo ${cert.recibo?.numRecibo ?? ''}`,
                      htmlPath: reciboHtmlPath(cert.recibo!.idIngreso),
                    })
                  }
                  style={[styles.btn, { backgroundColor: c.accent }]}
                >
                  <Ionicons name="receipt-outline" size={16} color="#fff" />
                  <ScaledText baseSize={13} style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>
                    Recibo
                  </ScaledText>
                </Pressable>
              ) : null}
            </View>
          </SurfaceCard>
        ))
      )}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
    borderWidth: 1,
  },
  certHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  certIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
