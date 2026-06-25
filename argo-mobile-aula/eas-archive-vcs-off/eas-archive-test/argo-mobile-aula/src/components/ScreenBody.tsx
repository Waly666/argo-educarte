import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { space } from '../theme/spacing';

type Props = {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  noPadding?: boolean;
  style?: ViewStyle;
};

export function ScreenBody({ children, refreshing, onRefresh, noPadding, style }: Props) {
  const c = useTheme();
  const [pulling, setPulling] = useState(false);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.bg }, style]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing || pulling}
            onRefresh={() => {
              setPulling(true);
              void Promise.resolve(onRefresh()).finally(() => setPulling(false));
            }}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        ) : undefined
      }
    >
      <View style={[styles.inner, noPadding && { paddingHorizontal: 0 }]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: space.xxl },
  inner: { paddingHorizontal: space.lg },
});
