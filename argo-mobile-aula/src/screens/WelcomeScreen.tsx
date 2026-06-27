import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CursoCard } from '../components/CursoCard';
import { EducarteHeroCard } from '../components/EducarteHeroCard';
import { HeroInfoCard } from '../components/HeroInfoCard';
import { InstBar } from '../components/InstBar';
import { PortalLogo } from '../components/PortalLogo';
import { PrimaryButton } from '../components/PrimaryButton';
import { QuickAction } from '../components/QuickAction';
import { ScaledText } from '../components/ScaledText';
import { SectionHeader } from '../components/SectionHeader';
import { SurfaceCard } from '../components/SurfaceCard';
import { APP_BRANDING } from '../config/appBranding';
import { usePortalBranding } from '../hooks/usePortalBranding';
import { usePortalConfig } from '../context/PortalConfigContext';
import { useTheme } from '../context/ThemeContext';
import { fetchCursos } from '../api/aulaApi';
import type { CursoVirtual } from '../api/types';
import type { RootStackParamList } from '../navigation/types';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

export default function WelcomeScreen() {
  const nav = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { config, refresh: refreshConfig } = usePortalConfig();
  const { nombreEmpresa } = usePortalBranding();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [destacados, setDestacados] = useState<CursoVirtual[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await Promise.all([
      refreshConfig(),
      (async () => {
        try {
          const rows = await fetchCursos();
          setDestacados(rows.slice(0, 6));
        } catch {
          setDestacados([]);
        }
      })(),
    ]);
  }, [refreshConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void refreshConfig();
    }, [refreshConfig]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const heroTitle = config?.heroTitulo?.trim() || APP_BRANDING.heroTitulo;
  const heroSub = config?.heroSubtitulo?.trim() || APP_BRANDING.heroSubtitulo;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <InstBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + space.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />
        }
      >
        <View style={styles.body}>
          <EducarteHeroCard style={styles.heroCard}>
            <View style={styles.heroBrand}>
              <PortalLogo width={112} height={52} hideLetterFallback />
              <ScaledText baseSize={11} style={styles.heroKicker}>
                AULA VIRTUAL · {nombreEmpresa.toUpperCase()}
              </ScaledText>
            </View>
            <ScaledText baseSize={24} style={styles.heroTitle}>
              {heroTitle}
            </ScaledText>
            <ScaledText baseSize={15} style={styles.heroLead}>
              {heroSub}
            </ScaledText>
            <View style={styles.heroCtas}>
              <PrimaryButton label="Iniciar sesión" onPress={() => nav.navigate('Login')} icon="log-in-outline" size="lg" />
              <PrimaryButton
                label="Explorar cursos"
                variant="light"
                onPress={() => nav.navigate('Catalogo')}
                icon="library-outline"
                size="lg"
              />
            </View>
          </EducarteHeroCard>

          <View style={styles.infoRow}>
            <HeroInfoCard
              icon="heart-outline"
              title="Impacto social"
              text="Proyectos y formación para comunidades del Cauca y Colombia."
            />
            <HeroInfoCard
              icon="phone-portrait-outline"
              title="100% en línea"
              text="Estudie desde su celular, a su ritmo y con acompañamiento."
            />
            <HeroInfoCard
              icon="ribbon-outline"
              title="Certificados"
              text="Consulte y descargue sus certificados al instante."
            />
          </View>

          <View style={styles.actions}>
            <QuickAction
              label="Certificados"
              subtitle="Consulta por documento"
              icon="ribbon-outline"
              tint={c.accent}
              onPress={() => nav.navigate('ConsultaCertificados')}
            />
            {config?.registroAbierto !== false ? (
              <QuickAction
                label="Registrarse"
                subtitle="Crea tu cuenta gratis"
                icon="person-add-outline"
                tint={c.ok}
                onPress={() => nav.navigate('Registro')}
              />
            ) : (
              <QuickAction
                label="Catálogo"
                subtitle="Todos los programas"
                icon="library-outline"
                tint={c.primary}
                onPress={() => nav.navigate('Catalogo')}
              />
            )}
          </View>

          {destacados.length > 0 ? (
            <>
              <SectionHeader
                title="Cursos destacados"
                subtitle="Empieza hoy mismo"
                icon="star-outline"
                iconColor={c.accent}
                iconBg={c.accentSoft}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} nestedScrollEnabled>
                {destacados.map((curso) => (
                  <View key={String(curso.idPrograma)} style={styles.hItem}>
                    <CursoCard
                      curso={curso}
                      layout="vertical"
                      onPress={() =>
                        nav.navigate('CursoDetalle', { id: String(curso.idPrograma), titulo: curso.nombreProg })
                      }
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}

          <SurfaceCard style={[styles.footerBand, shadow.sm]}>
            <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>
              ¿Listo para aprender con Educarte?
            </ScaledText>
            <ScaledText baseSize={13} style={{ color: c.textSoft, textAlign: 'center', marginTop: 6, marginBottom: space.md }}>
              Ingrese al aula virtual y continúe su formación donde la dejó.
            </ScaledText>
            <PrimaryButton label="Ver todos los cursos" variant="accent" onPress={() => nav.navigate('Catalogo')} fullWidth icon="library-outline" />
          </SurfaceCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  heroCard: {
    marginBottom: space.lg,
  },
  heroBrand: {
    marginBottom: space.md,
    gap: space.sm,
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#fff',
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: space.sm,
  },
  heroLead: {
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 23,
    marginBottom: space.lg,
  },
  heroCtas: {
    gap: space.sm,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.lg,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  hScroll: { marginHorizontal: -space.lg, paddingHorizontal: space.lg, marginBottom: space.lg },
  hItem: { width: 280, marginRight: space.md },
  footerBand: {
    borderRadius: radius.lg,
    marginBottom: space.lg,
  },
});
