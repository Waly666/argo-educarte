import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ScaledText } from '../components/ScaledText';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchProgreso } from '../api/aulaApi';
import { getApiBaseUrl } from '../config/apiBase';
import type { RootStackParamList } from '../navigation/types';

export default function CoursePlayerScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CoursePlayer'>>();
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { state } = useAuth();
  const c = useTheme();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const token = state.status === 'signedIn' ? state.token : null;

  const sendInit = useCallback(() => {
    if (!token || !webRef.current) return;
    const payload = {
      type: 'ARGO_INIT',
      apiUrl: `${getApiBaseUrl()}/aula-virtual`,
      token,
      idPrograma: route.params.idPrograma,
      storagePrefix: route.params.storagePrefix,
    };
    const sync = { type: 'ARGO_SYNC_REQUEST' };
    const js = `
      (function(){
        var a = ${JSON.stringify(payload)};
        var b = ${JSON.stringify(sync)};
        window.dispatchEvent(new MessageEvent('message', { data: a }));
        window.dispatchEvent(new MessageEvent('message', { data: b }));
      })();
      true;
    `;
    webRef.current.injectJavaScript(js);
  }, [token, route.params]);

  useEffect(() => {
    const t1 = setTimeout(sendInit, 600);
    const t2 = setTimeout(sendInit, 1800);
    const poll = setInterval(() => {
      void fetchProgreso(route.params.idPrograma).catch(() => {});
      sendInit();
    }, 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(poll);
    };
  }, [sendInit, route.params.idPrograma]);

  function onMessage(ev: WebViewMessageEvent) {
    try {
      const data = JSON.parse(ev.nativeEvent.data) as { type?: string };
      if (data.type === 'ARGO_PROGRESO_ACTUALIZADO') {
        void fetchProgreso(route.params.idPrograma).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }

  const onClose = useCallback(() => {
    sendInit();
    setTimeout(() => nav.goBack(), 500);
  }, [nav, sendInit]);

  React.useLayoutEffect(() => {
    nav.setOptions({
      title: route.params.titulo,
      headerRight: () => (
        <ScaledText
          baseSize={14}
          onPress={onClose}
          style={{ color: '#fff', marginRight: 16, fontWeight: '700' }}
        >
          Cerrar
        </ScaledText>
      ),
    });
  }, [nav, route.params.titulo, onClose]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : null}
      <WebView
        ref={webRef}
        source={{ uri: route.params.playerUrl }}
        onLoadEnd={() => {
          setLoading(false);
          sendInit();
        }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onError={() => Alert.alert('Curso', 'No se pudo cargar el contenido')}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
