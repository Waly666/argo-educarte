import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconInput } from '../components/IconInput';
import { InstBar } from '../components/InstBar';
import { PortalLogo } from '../components/PortalLogo';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScaledText } from '../components/ScaledText';
import { StarfieldHero } from '../components/StarfieldHero';
import { SurfaceCard } from '../components/SurfaceCard';
import { APP_BRANDING } from '../config/appBranding';
import { useAuth } from '../context/AuthContext';
import { usePortalConfig } from '../context/PortalConfigContext';
import { useTheme } from '../context/ThemeContext';
import { pingHealth } from '../api/client';
import { getApiBaseUrl, SERVIDOR_API_STORAGE_KEY } from '../config/apiBase';
import { loadSavedLogin, persistSavedLogin } from '../storage/loginCredentials';
import { secureGet } from '../storage/safeStore';
import type { RootStackParamList } from '../navigation/types';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

export default function LoginScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { signIn, setServidor } = useAuth();
  const { config } = usePortalConfig();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [servidor, setServidorLocal] = useState('');
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showServer, setShowServer] = useState(false);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [s, saved] = await Promise.all([secureGet(SERVIDOR_API_STORAGE_KEY), loadSavedLogin()]);
      if (cancelled) return;
      const base = s || getApiBaseUrl();
      setServidorLocal(base.replace(/\/api\/?$/i, ''));
      setRemember(saved.remember);
      if (saved.remember) {
        setEmail(saved.email);
        setPass(saved.password);
      }
      setBootDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogin() {
    setErr(null);
    setStatus(null);
    if (!email.trim()) {
      setErr('Escriba su correo');
      return;
    }
    if (!pass) {
      setErr('Escriba la contraseña');
      return;
    }
    setLoading(true);
    try {
      if (servidor.trim()) {
        setStatus('Guardando servidor…');
        await setServidor(servidor);
      }
      setStatus('Conectando…');
      const ok = await pingHealth();
      if (!ok) throw new Error(`Sin conexión con ${getApiBaseUrl()}`);
      setStatus('Iniciando sesión…');
      await signIn(email, pass);
      void persistSavedLogin(remember, email, pass);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error de acceso');
    } finally {
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <InstBar />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <StarfieldHero minHeight={200} includeSafeTop={false} roundedBottom={false}>
          <Pressable onPress={() => nav.goBack()} style={styles.back} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={c.accent} />
          </Pressable>
          <PortalLogo width={120} height={56} hideLetterFallback />
          <ScaledText baseSize={14} style={[styles.brandAula, { color: c.accent }]}>
            {APP_BRANDING.tituloApp}
          </ScaledText>
          <ScaledText baseSize={16} style={[styles.brandEmpresa, { color: c.text }]}>
            {APP_BRANDING.nombreEmpresa}
          </ScaledText>
        </StarfieldHero>

        <SurfaceCard style={{ marginHorizontal: space.lg, marginTop: -32, borderRadius: radius.xl, ...shadow.lg }}>
          <ScaledText baseSize={22} style={{ color: c.text, fontWeight: '800', marginBottom: 4 }}>
            Iniciar sesión
          </ScaledText>
          <ScaledText baseSize={14} style={{ color: c.textSoft, marginBottom: space.lg }}>
            Accede a tus cursos y certificados
          </ScaledText>

          {bootDone ? (
            <>
              <IconInput
                value={email}
                onChangeText={setEmail}
                placeholder="Correo electrónico"
                icon="mail-outline"
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                returnKeyType="next"
              />
              <IconInput
                value={pass}
                onChangeText={setPass}
                placeholder="Contraseña"
                icon="lock-closed-outline"
                secureTextEntry
                textContentType="password"
                autoComplete="password"
                returnKeyType="go"
                onSubmitEditing={() => void onLogin()}
              />
            </>
          ) : (
            <ActivityIndicator color={c.primary} style={{ marginVertical: space.lg }} />
          )}

          <Pressable onPress={() => setRemember((r) => !r)} style={styles.remember}>
            <View style={[styles.check, { borderColor: remember ? c.primary : c.border, backgroundColor: remember ? c.primary : c.inputBg }]}>
              {remember ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <ScaledText baseSize={14} style={{ color: c.textSoft }}>
              Recordar credenciales
            </ScaledText>
          </Pressable>

          {err ? (
            <View style={[styles.alert, { backgroundColor: c.dangerSoft }]}>
              <Ionicons name="alert-circle" size={18} color={c.danger} />
              <ScaledText baseSize={14} style={{ color: c.danger, flex: 1, marginLeft: 8 }}>
                {err}
              </ScaledText>
            </View>
          ) : null}

          {status ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={c.primary} />
              <ScaledText baseSize={13} style={{ color: c.textSoft, marginLeft: 8 }}>
                {status}
              </ScaledText>
            </View>
          ) : null}

          <PrimaryButton label="Entrar al aula" onPress={onLogin} loading={loading} fullWidth icon="log-in-outline" size="lg" />

          <Pressable onPress={() => setShowServer((s) => !s)} style={styles.serverToggle}>
            <Ionicons name="server-outline" size={16} color={c.textSoft} />
            <ScaledText baseSize={13} style={{ color: c.textSoft, marginLeft: 6 }}>
              {showServer ? 'Ocultar servidor' : 'Configurar servidor'}
            </ScaledText>
          </Pressable>
          {showServer ? (
            <IconInput
              value={servidor}
              onChangeText={setServidorLocal}
              placeholder="https://app.finstruvial.edu.co"
              icon="globe-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : null}
        </SurfaceCard>

        <View style={[styles.links, { paddingHorizontal: space.lg }]}>
          {config?.registroAbierto !== false ? (
            <LinkRow label="Crear cuenta nueva" icon="person-add-outline" onPress={() => nav.navigate('Registro')} />
          ) : null}
          <LinkRow label="Explorar cursos" icon="library-outline" onPress={() => nav.navigate('Catalogo')} />
          <LinkRow label="Consultar certificados" icon="ribbon-outline" onPress={() => nav.navigate('ConsultaCertificados')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import type { ComponentProps } from 'react';

function LinkRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.linkIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <ScaledText baseSize={14} style={{ color: c.text, fontWeight: '600', flex: 1 }}>
        {label}
      </ScaledText>
      <Ionicons name="chevron-forward" size={16} color={c.textSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  back: { alignSelf: 'flex-start', marginBottom: space.md },
  brandEmpresa: { fontWeight: '700', textAlign: 'center', marginTop: 4 },
  brandAula: {
    fontWeight: '800',
    textAlign: 'center',
    marginTop: space.sm,
    letterSpacing: 1.5,
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  serverToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.lg },
  links: { marginTop: space.xl, gap: space.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
});
