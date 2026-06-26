import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CursoCard } from '../components/CursoCard';
import { HeroInfoCard } from '../components/HeroInfoCard';
import { InstBar } from '../components/InstBar';
import { PrimaryButton } from '../components/PrimaryButton';
import { QuickAction } from '../components/QuickAction';
import { ScaledText } from '../components/ScaledText';
import { SectionHeader } from '../components/SectionHeader';
import { APP_BRANDING } from '../config/appBranding';
import { usePortalBranding } from '../hooks/usePortalBranding';
import { usePortalConfig } from '../context/PortalConfigContext';
import { useTheme } from '../context/ThemeContext';
import { fetchCursos } from '../api/aulaApi';
import type { CursoVirtual } from '../api/types';
import { resolveUploadUrl } from '../utils/uploadUrl';
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
  const [heroRemoteFailed, setHeroRemoteFailed] = useState(false);

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

  const heroRemote =
    resolveUploadUrl(config?.site?.tema?.urlHeroAbsoluta) || resolveUploadUrl(config?.site?.tema?.urlHero);
  const heroTitle = config?.heroTitulo?.trim() || APP_BRANDING.heroTitulo;
  const heroSub = config?.heroSubtitulo?.trim() || APP_BRANDING.heroSubtitulo;

  const heroSource = useMemo((): ImageSourcePropType => {
    if (heroRemote && !heroRemoteFailed) {
      return { uri: heroRemote };
    }
    return APP_BRANDING.heroLocal;
  }, [heroRemote, heroRemoteFailed]);

  const heroColors =
    c.gradientHero.length >= 3
      ? (c.gradientHero as [string, string, string])
      : ([c.gradientHero[0], c.gradientHero[1], c.bg] as [string, string, string]);

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
        <View style={styles.heroBlock}>
          <ImageBackground
            source={heroSource}
            style={styles.heroImageBand}
            imageStyle={styles.heroImage}
            resizeMode="cover"
            onError={() => setHeroRemoteFailed(true)}
          >
            <LinearGradient colors={['rgba(253,251,247,0.15)', 'rgba(253,251,247,0.88)']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.heroBadgeRow}>
              <View style={[styles.heroBadge, { backgroundColor: `${c.primary}33`, borderColor: `${c.primary}55` }]}>
                <ScaledText baseSize={10} style={{ color: c.accent, fontWeight: '700', letterSpacing: 0.8 }}>
                  AULA VIRTUAL
                </ScaledText>
              </View>
            </View>
          </ImageBackground>

          <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroPanel}>
            <ScaledText baseSize={11} style={[styles.kicker, { color: c.accent }]}>
              {nombreEmpresa}
            </ScaledText>
            <ScaledText baseSize={26} style={[styles.heroTitle, { color: c.text }]}>
              {heroTitle}
            </ScaledText>
            <ScaledText baseSize={15} style={[styles.heroLead, { color: c.textSoft }]}>
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
          </LinearGradient>
        </View>

        <View style={[styles.infoRow, { marginTop: space.lg }]}>
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

        <View style={styles.body}>
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

          <View style={[styles.footerBand, { backgroundColor: c.cardElevated, borderColor: c.border }]}>
            <ScaledText baseSize={15} style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>
              ¿Listo para aprender con Educarte?
            </ScaledText>
            <ScaledText baseSize={13} style={{ color: c.textSoft, textAlign: 'center', marginTop: 6, marginBottom: space.md }}>
              Ingrese al aula virtual y continúe su formación donde la dejó.
            </ScaledText>
            <PrimaryButton label="Ver todos los cursos" variant="accent" onPress={() => nav.navigate('Catalogo')} fullWidth icon="library-outline" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  heroBlock: {
    overflow: 'hidden',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197, 160, 89, 0.28)',
  },
  heroImageBand: {
    width: '100%',
    height: 200,
    justifyContent: 'flex-end',
  },
  heroImage: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  heroBadgeRow: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  heroPanel: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
  },
  kicker: {
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  heroTitle: {
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: space.sm,
  },
  heroLead: {
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
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  body: {
    paddingHorizontal: space.lg,
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
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.lg,
    ...shadow.sm,
  },
});
