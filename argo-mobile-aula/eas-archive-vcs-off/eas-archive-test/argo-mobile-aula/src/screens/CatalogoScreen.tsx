import React from 'react';
import { StyleSheet, View } from 'react-native';

import { CatalogoContent } from '../components/CatalogoContent';
import { useTheme } from '../context/ThemeContext';

export default function CatalogoScreen() {
  const c = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <CatalogoContent />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
