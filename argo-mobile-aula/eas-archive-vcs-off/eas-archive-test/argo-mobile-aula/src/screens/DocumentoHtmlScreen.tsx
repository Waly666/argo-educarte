import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import { apiFetchText } from '../api/client';
import { ScaledText } from '../components/ScaledText';
import { useTheme } from '../context/ThemeContext';
import { getServerPublicOrigin, rewriteDocumentHtmlForMobile } from '../utils/documentHtml';
import type { RootStackParamList } from '../navigation/types';

export default function DocumentoHtmlScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DocumentoHtml'>>();
  const c = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const raw = await apiFetchText(route.params.htmlPath);
      setHtml(rewriteDocumentHtmlForMobile(raw, route.params.htmlPath));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar');
      setHtml(null);
    } finally {
      setLoading(false);
    }
  }, [route.params.htmlPath]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }
  if (err || !html) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ScaledText baseSize={15} style={{ color: c.danger, textAlign: 'center' }}>
          {err ?? 'Sin contenido'}
        </ScaledText>
      </View>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{
        html,
        baseUrl: `${getServerPublicOrigin()}/`,
      }}
      style={{ flex: 1, backgroundColor: c.bg }}
      scalesPageToFit={false}
      textZoom={100}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
