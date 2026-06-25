import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ScaledText } from '../components/ScaledText';
import { AlertBannerStack } from '../components/AlertBannerStack';
import { ModuleTile } from '../components/ModuleTile';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';
import { APP_MODULES } from '../theme/modules';
import { tienePermiso } from '../utils/permisos';
import type { RootStackParamList } from '../navigation/types';

export default function HomeScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { state, signOut } = useAuth();
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);
  const user = state.status === 'signedIn' ? state.user : null;

  const visible = APP_MODULES.filter(
    (t) => !t.permiso || tienePermiso(user?.permisos, t.permiso, user?.rol),
  );
  const displayName = user?.nombres || user?.username || 'usuario';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <AlertBannerStack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={highContrast ? [c.card, c.bgAlt] : ['#4f46e5', '#7c3aed']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcome}
        >
          <View style={styles.welcomeRow}>
            <View style={styles.avatar}>
              <ScaledText baseSize={20} style={{ color: '#4f46e5', fontWeight: '800' }}>
                {initials || '?'}
              </ScaledText>
            </View>
            <View style={{ flex: 1 }}>
              <ScaledText baseSize={13} style={{ color: 'rgba(255,255,255,0.85)' }}>
                Bienvenido
              </ScaledText>
              <ScaledText baseSize={22} style={{ color: '#fff', fontWeight: '800' }}>
                {displayName}
              </ScaledText>
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#4f46e5" />
                <ScaledText baseSize={12} style={{ color: '#4f46e5', fontWeight: '700' }}>
                  {user?.rolNombre || user?.rol || 'Sin rol'}
                </ScaledText>
              </View>
            </View>
          </View>
        </LinearGradient>

        <ScaledText baseSize={16} style={{ color: c.text, fontWeight: '800', marginBottom: 12 }}>
          Módulos
        </ScaledText>

        <View style={styles.grid}>
          {visible.map((t) => (
            <ModuleTile
              key={t.key}
              module={t}
              onPress={() =>
                nav.navigate(
                  t.key as 'Caja' | 'Alumnos' | 'Certificados' | 'Facturacion' | 'Programas' | 'Servicios' | 'Ajustes',
                )
              }
            />
          ))}
        </View>

        <Pressable
          onPress={() => void signOut()}
          style={({ pressed }) => [
            styles.logout,
            {
              borderColor: c.danger,
              backgroundColor: pressed ? c.dangerBg : c.card,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={c.danger} />
          <ScaledText baseSize={16} style={{ color: c.danger, fontWeight: '700' }}>
            Cerrar sesión
          </ScaledText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 36 },
  welcome: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  logout: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
});
