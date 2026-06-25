import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import { apiFetchText } from '../../api/client';
import { getServerPublicOrigin, rewriteDocumentHtmlForMobile } from '../../utils/documentHtml';
import { PrimaryButton } from '../../components/PrimaryButton';
import { ScaledText } from '../../components/ScaledText';
import { useAccessibility } from '../../context/AccessibilityContext';
import { compartirHtmlPdf, imprimirHtml } from '../../services/documentoPrint';
import { themeColors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

export default function DocumentoViewerScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DocumentoViewer'>>();
  const { title, htmlPath } = route.params;
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const raw = await apiFetchText(htmlPath);
      setHtml(rewriteDocumentHtmlForMobile(raw, htmlPath));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar el documento');
      setHtml(null);
    } finally {
      setLoading(false);
    }
  }, [htmlPath]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onImprimir() {
    if (!html) return;
    setBusy(true);
    try {
      await imprimirHtml(html);
    } catch (e) {
      Alert.alert('Impresión', e instanceof Error ? e.message : 'No se pudo imprimir');
    } finally {
      setBusy(false);
    }
  }

  async function onCompartir() {
    if (!html) return;
    setBusy(true);
    try {
      await compartirHtmlPdf(html, title);
    } catch (e) {
      Alert.alert('Compartir', e instanceof Error ? e.message : 'No se pudo generar PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
          <ScaledText baseSize={14} style={{ color: c.textSoft, marginTop: 12 }}>
            Cargando documento…
          </ScaledText>
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={c.danger} />
          <ScaledText baseSize={15} style={{ color: c.danger, marginTop: 12, textAlign: 'center' }}>
            {err}
          </ScaledText>
          <PrimaryButton label="Reintentar" onPress={() => void load()} style={{ marginTop: 16 }} />
        </View>
      ) : html ? (
        <WebView
          originWhitelist={['*']}
          source={{
            html,
            baseUrl: `${getServerPublicOrigin()}/`,
          }}
          style={styles.web}
          scalesPageToFit={false}
          textZoom={100}
          setBuiltInZoomControls
          setDisplayZoomControls
          allowsInlineMediaPlayback
        />
      ) : null}

      {html && !loading ? (
        <View style={[styles.footer, { backgroundColor: c.card, borderTopColor: c.border }]}>
          <PrimaryButton
            label="Imprimir"
            icon="print-outline"
            onPress={() => void onImprimir()}
            disabled={busy}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Compartir PDF"
            icon="share-outline"
            variant="ghost"
            onPress={() => void onCompartir()}
            disabled={busy}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  web: { flex: 1, backgroundColor: '#fff' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
});
