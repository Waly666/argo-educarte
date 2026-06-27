import React, { useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PortalConfigProvider } from './src/context/PortalConfigContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { BootstrapScreen, SplashGate } from './src/bootstrap/splash';
import { WhatsAppFloatButton } from './src/components/WhatsAppFloatButton';
import { DashboardHeaderBackground } from './src/components/DashboardHeaderBackground';
import LoginScreen from './src/screens/LoginScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import CatalogoScreen from './src/screens/CatalogoScreen';
import CursoDetalleScreen from './src/screens/CursoDetalleScreen';
import RegistroScreen from './src/screens/RegistroScreen';
import ConsultaCertificadosScreen from './src/screens/ConsultaCertificadosScreen';
import AulaHubScreen from './src/screens/AulaHubScreen';
import CoursePlayerScreen from './src/screens/CoursePlayerScreen';
import DocumentoHtmlScreen from './src/screens/DocumentoHtmlScreen';
import EvaluacionCohorteScreen from './src/screens/EvaluacionCohorteScreen';
import type { RootStackParamList } from './src/navigation/types';
import type { ThemeVariant } from './src/theme/colors';

const Stack = createStackNavigator<RootStackParamList>();

function ThemedNavigator() {
  const { state } = useAuth();
  const c = useTheme();
  const navTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: c.primary,
        background: c.bg,
        card: c.headerBg,
        text: c.text,
        border: c.border,
      },
    }),
    [c.primary, c.bg, c.headerBg, c.text, c.border],
  );

  const headerOptions = useMemo(
    () => ({
      headerTintColor: state.status === 'signedIn' ? c.headerTitle : c.primary,
      headerBackground: state.status === 'signedIn' ? () => <DashboardHeaderBackground /> : undefined,
      headerStyle: {
        backgroundColor: state.status === 'signedIn' ? c.headerBg : c.headerBg,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: c.headerBorder,
      },
      headerTitleStyle: { fontWeight: '800' as const, color: state.status === 'signedIn' ? c.headerTitle : c.text, fontSize: 17 },
      cardStyle: { backgroundColor: c.bg },
    }),
    [c.primary, c.headerBg, c.headerBorder, c.text, c.bg, c.headerTitle, state.status],
  );

  if (state.status === 'loading') {
    return (
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Bootstrap" component={BootstrapScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={headerOptions}>
        {state.status === 'signedIn' ? (
          <>
            <Stack.Screen name="AulaHub" component={AulaHubScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="CoursePlayer"
              component={CoursePlayerScreen}
              options={({ route }) => ({ title: route.params.titulo })}
            />
            <Stack.Screen
              name="DocumentoHtml"
              component={DocumentoHtmlScreen}
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              name="EvaluacionCohorte"
              component={EvaluacionCohorteScreen}
              options={({ route }) => ({ title: route.params.titulo })}
            />
            <Stack.Screen name="Catalogo" component={CatalogoScreen} options={{ title: 'Cursos' }} />
            <Stack.Screen
              name="CursoDetalle"
              component={CursoDetalleScreen}
              options={({ route }) => ({ title: route.params.titulo ?? 'Curso' })}
            />
            <Stack.Screen
              name="ConsultaCertificados"
              component={ConsultaCertificadosScreen}
              options={{ title: 'Consultar certificados' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Registro" component={RegistroScreen} options={{ title: 'Registro' }} />
            <Stack.Screen name="Catalogo" component={CatalogoScreen} options={{ title: 'Cursos' }} />
            <Stack.Screen
              name="CursoDetalle"
              component={CursoDetalleScreen}
              options={({ route }) => ({ title: route.params.titulo ?? 'Curso' })}
            />
            <Stack.Screen
              name="ConsultaCertificados"
              component={ConsultaCertificadosScreen}
              options={{ title: 'Consultar certificados' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppShell() {
  const { state } = useAuth();
  const variant: ThemeVariant = state.status === 'signedIn' ? 'dashboard' : 'public';
  const waExtraBottom = state.status === 'signedIn' ? 68 : 0;

  return (
    <ThemeProvider variant={variant}>
      <SplashGate>
        <View style={{ flex: 1 }} pointerEvents="box-none">
          <ThemedNavigator />
          {state.status !== 'loading' ? <WhatsAppFloatButton extraBottom={waExtraBottom} /> : null}
        </View>
      </SplashGate>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PortalConfigProvider>
            <AppShell />
          </PortalConfigProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
