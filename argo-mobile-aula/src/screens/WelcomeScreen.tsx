import React, { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { StarfieldHero } from '../components/StarfieldHero';
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

  const heroImg = resolveUploadUrl(config?.site?.tema?.urlHeroAbsoluta) || resolveUploadUrl(config?.site?.tema?.urlHero);
  const heroTitle = config?.heroTitulo?.trim() || 'Formación virtual certificada';
  const heroSub =
    config?.heroSubtitulo?.trim() ||
    'Cursos en seguridad vial y tránsito. Estudie en línea y certifique su formación con FINSTRUVIAL.';

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
        <StarfieldHero minHeight={280} includeSafeTop={false} roundedBottom={false}>
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
            label="Cursos"
            variant="light"
            onPress={() => nav.navigate('Catalogo')}
            icon="library-outline"
            size="lg"
            />
          </View>
          {heroImg ? (
            <View style={[styles.heroImgWrap, shadow.lg]}>
              <Image source={{ uri: heroImg }} style={styles.heroImg} resizeMode="cover" />
            </View>
          ) : null}
        </StarfieldHero>

        <View style={[styles.infoRow, { marginTop: -space.xl }]}>
          <HeroInfoCard
            icon="school-outline"
            title="Certificación"
            text="Programas avalados para conductores e instituciones."
          />
          <HeroInfoCard
            icon="phone-portrait-outline"
            title="100% en línea"
            text="Estudie desde su celular, a su ritmo."
          />
          <HeroInfoCard
            icon="ribbon-outline"
            title="Consulta"
            text="Verifique certificados en línea al instante."
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
              ¿Listo para certificarse?
            </ScaledText>
            <ScaledText baseSize={13} style={{ color: c.textSoft, textAlign: 'center', marginTop: 6, marginBottom: space.md }}>
              Acceda al aula virtual y continúe su formación profesional.
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
    marginBottom: space.lg,
  },
  heroImgWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  heroImg: { width: '100%', height: 168 },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    marginBottom: space.lg,
    zIndex: 2,
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
