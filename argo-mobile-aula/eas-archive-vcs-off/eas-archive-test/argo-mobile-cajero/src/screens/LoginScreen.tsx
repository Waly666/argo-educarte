import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmpresaBrandHeader } from '../components/EmpresaBrandHeader';
import { ScaledText } from '../components/ScaledText';
import { PrimaryButton } from '../components/PrimaryButton';
import { IconInput } from '../components/IconInput';
import { SurfaceCard } from '../components/SurfaceCard';
import { CAJERO_AZUL_REY } from '../config/appBranding';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { pingHealth } from '../api/client';
import { getApiBaseUrl, SERVIDOR_API_STORAGE_KEY, normalizeApiBaseUrl } from '../config/apiBase';
import { loadSavedLogin, persistSavedLogin } from '../storage/loginCredentials';
import { storeGet } from '../storage/safeStore';
import { themeColors } from '../theme/colors';

export default function LoginScreen() {
  const { signIn, setServidor } = useAuth();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [servidor, setServidorLocal] = useState('');
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, saved] = await Promise.all([
        storeGet(SERVIDOR_API_STORAGE_KEY),
        loadSavedLogin(),
      ]);
      const base = s || getApiBaseUrl();
      setServidorLocal(base.replace(/\/api\/?$/i, ''));
      setRemember(saved.remember);
      if (saved.remember) {
        setUser(saved.username);
        setPass(saved.password);
      }
    })();
  }, []);

  async function onLogin() {
    setErr(null);
    setStatus(null);

    const usuario = user.trim();
    if (!usuario) {
      setErr('Escriba el usuario');
      return;
    }
    if (!pass) {
      setErr('Escriba la contraseña');
      return;
    }
    if (!servidor.trim()) {
      setErr('Escriba la dirección del servidor (IP de la PC)');
      return;
    }

    setLoading(true);
    try {
      setStatus('Guardando servidor…');
      await setServidor(servidor);

      setStatus(`Probando ${getApiBaseUrl()}…`);
      await pingHealth();

      setStatus('Iniciando sesión…');
      await signIn(usuario, pass);
      void persistSavedLogin(remember, usuario, pass);
      setStatus(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error de acceso';
      setErr(msg);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.hero}>
          <EmpresaBrandHeader logoWidth={152} logoHeight={78} onDark />
          <View style={styles.chips}>
            <Chip icon="cash-outline" label="Caja" />
            <Chip icon="school-outline" label="Alumnos" />
            <Chip icon="notifications-outline" label="Alertas" />
          </View>
        </View>

        <SurfaceCard style={styles.formCard}>
          <IconInput
            label="Servidor API (IP de la PC + :3000)"
            icon="server-outline"
            iconColor={c.accent}
            value={servidor}
            onChangeText={setServidorLocal}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.45:3000"
          />
          <ScaledText baseSize={12} style={{ color: c.textSoft, marginBottom: 12 }}>
            API: {normalizeApiBaseUrl(servidor || getApiBaseUrl())}
          </ScaledText>

          <IconInput
            label="Usuario"
            icon="person-outline"
            value={user}
            onChangeText={setUser}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Tu usuario ARGO"
          />

          <IconInput
            label="Contraseña"
            icon="lock-closed-outline"
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={() => void onLogin()}
            placeholder="••••••••"
          />

          <Pressable
            onPress={() => setRemember((v) => !v)}
            style={styles.rememberRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
          >
            <Switch
              value={remember}
              onValueChange={setRemember}
              trackColor={{ false: '#cbd5e1', true: '#9fa8da' }}
              thumbColor={remember ? CAJERO_AZUL_REY : '#f8fafc'}
            />
            <ScaledText baseSize={14} style={{ color: c.text, flex: 1 }}>
              Recordar usuario y contraseña
            </ScaledText>
          </Pressable>

          {status ? (
            <View style={[styles.msgBox, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="sync-outline" size={18} color={c.primary} />
              <ScaledText baseSize={14} style={{ color: c.primary, fontWeight: '600', flex: 1 }}>
                {status}
              </ScaledText>
            </View>
          ) : null}

          {err ? (
            <View style={[styles.msgBox, { backgroundColor: c.dangerBg }]}>
              <Ionicons name="alert-circle-outline" size={18} color={c.danger} />
              <ScaledText baseSize={14} style={{ color: c.danger, flex: 1, lineHeight: 20 }}>
                {err}
              </ScaledText>
            </View>
          ) : null}

          <View style={{ marginTop: 18 }}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={c.primary} size="large" />
                <ScaledText baseSize={14} style={{ color: c.textSoft }}>
                  Espere…
                </ScaledText>
              </View>
            ) : (
              <PrimaryButton
                label="Entrar"
                icon="log-in-outline"
                onPress={() => void onLogin()}
                fullWidth
              />
            )}
          </View>
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color="#fff" />
      <ScaledText baseSize={12} style={{ color: '#fff', fontWeight: '600' }}>
        {label}
      </ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  hero: {
    paddingTop: 52,
    paddingBottom: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: CAJERO_AZUL_REY,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  formCard: {
    marginHorizontal: 20,
    marginTop: -22,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  msgBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  loadingBox: { alignItems: 'center', gap: 10, paddingVertical: 8 },
});
