import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/spacing';
import { shadow } from '../theme/shadows';

type Props = {
  children?: React.ReactNode;
  minHeight?: number;
  style?: ViewStyle;
  roundedBottom?: boolean;
  includeSafeTop?: boolean;
};

/** @deprecated Usar EducarteHeroCard. Wrapper crema con hero verde Educarte. */
export function StarfieldHero({ children, style }: Props) {
  const c = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient
        colors={c.gradientDashHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, shadow.lg]}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  card: {
    borderRadius: radius.xl,
    padding: space.xl,
    overflow: 'hidden',
    minHeight: 160,
  },
});
