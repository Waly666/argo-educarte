import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PortalHeaderTitle } from '../components/PortalHeaderTitle';
import { DashboardHeaderBackground } from '../components/DashboardHeaderBackground';
import { useTheme } from '../context/ThemeContext';
import type { AulaTabParamList } from '../navigation/types';
import { space } from '../theme/spacing';
import { shadow } from '../theme/shadows';
import CursosPanel from './aula/CursosPanel';
import TableroPanel from './aula/TableroPanel';
import MisCursosPanel from './aula/MisCursosPanel';
import PresencialesPanel from './aula/PresencialesPanel';
import PuntajesPanel from './aula/PuntajesPanel';
import CertificadosPanel from './aula/CertificadosPanel';
import ForoPanel from './aula/ForoPanel';
import PerfilPanel from './aula/PerfilPanel';

const Tab = createBottomTabNavigator<AulaTabParamList>();
type IonName = ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AulaTabParamList, { active: IonName; inactive: IonName }> = {
  Tablero: { active: 'grid', inactive: 'grid-outline' },
  Cursos: { active: 'library', inactive: 'library-outline' },
  MisCursos: { active: 'book', inactive: 'book-outline' },
  Presenciales: { active: 'people', inactive: 'people-outline' },
  Puntajes: { active: 'stats-chart', inactive: 'stats-chart-outline' },
  Certificados: { active: 'ribbon', inactive: 'ribbon-outline' },
  Foro: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Perfil: { active: 'person', inactive: 'person-outline' },
};

const TAB_SUBTITLES: Record<keyof AulaTabParamList, string> = {
  Tablero: 'Inicio',
  Cursos: 'Explorar y matricularse',
  MisCursos: 'Mis cursos',
  Presenciales: 'Clases presenciales',
  Puntajes: 'Mis puntajes',
  Certificados: 'Certificados',
  Foro: 'Foro',
  Perfil: 'Mi perfil',
};

export default function AulaHubScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerBackground: () => <DashboardHeaderBackground />,
        headerStyle: {
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: c.headerBorder,
        },
        headerTintColor: c.headerTitle,
        headerTitleStyle: { fontWeight: '800', fontSize: 17, color: c.headerTitle },
        headerTitle: () => <PortalHeaderTitle subtitle={TAB_SUBTITLES[route.name]} />,
        headerShadowVisible: false,
        tabBarActiveTintColor: c.tabBarActive,
        tabBarInactiveTintColor: c.textSoft,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopWidth: 0,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 2 : space.sm,
          paddingTop: space.sm,
          ...shadow.lg,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: -2,
        },
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            name={focused ? TAB_ICONS[route.name].active : TAB_ICONS[route.name].inactive}
            size={focused ? size + 2 : size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Tablero" component={TableroPanel} options={{ title: 'Inicio', tabBarLabel: 'Inicio' }} />
      <Tab.Screen name="Cursos" component={CursosPanel} options={{ title: 'Cursos', tabBarLabel: 'Cursos' }} />
      <Tab.Screen name="MisCursos" component={MisCursosPanel} options={{ title: 'Mis cursos', tabBarLabel: 'Matriculados' }} />
      <Tab.Screen name="Presenciales" component={PresencialesPanel} options={{ title: 'Presenciales', tabBarLabel: 'Clases' }} />
      <Tab.Screen name="Puntajes" component={PuntajesPanel} options={{ title: 'Mis puntajes', tabBarLabel: 'Notas' }} />
      <Tab.Screen name="Certificados" component={CertificadosPanel} options={{ title: 'Certificados', tabBarLabel: 'Certs' }} />
      <Tab.Screen
        name="Foro"
        component={ForoPanel}
        options={{ title: 'Foro', tabBarLabel: 'Foro', headerShown: false }}
      />
      <Tab.Screen name="Perfil" component={PerfilPanel} options={{ title: 'Mi perfil', tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}
