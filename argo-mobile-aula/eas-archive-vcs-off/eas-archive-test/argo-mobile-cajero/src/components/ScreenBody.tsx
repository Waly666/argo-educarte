import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';

import { AlertBannerStack } from './AlertBannerStack';
import { useAccessibility } from '../context/AccessibilityContext';
import { themeColors } from '../theme/colors';

type Props = {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  noAlerts?: boolean;
};

export function ScreenBody({ children, refreshing, onRefresh, style, noAlerts }: Props) {
  const { highContrast } = useAccessibility();
  const c = themeColors(highContrast);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {!noAlerts ? <AlertBannerStack /> : null}
      <ScrollView
        contentContainerStyle={[styles.body, style]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { padding: 16, paddingBottom: 32 },
});
