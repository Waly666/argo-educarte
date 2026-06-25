import 'react-native-gesture-handler';
import './src/disable-native-screens';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { registerRootComponent } from 'expo';

import App from './App';
import { CAJERO_AZUL_REY } from './src/config/appBranding';

SplashScreen.preventAutoHideAsync().catch(() => {});
void SystemUI.setBackgroundColorAsync(CAJERO_AZUL_REY);

registerRootComponent(App);
