import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

type Props = TextProps & { baseSize?: number };

export function ScaledText({ baseSize = 16, style, ...rest }: Props) {
  return <Text style={[{ fontSize: baseSize }, style]} {...rest} />;
}

const styles = StyleSheet.create({});
