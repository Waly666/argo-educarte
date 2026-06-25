import React from 'react';
import { TextStyle } from 'react-native';

import { ScaledText } from './ScaledText';
import { formatMoney } from '../utils/format';

type Props = {
  value: number | null | undefined;
  baseSize?: number;
  style?: TextStyle;
  bold?: boolean;
};

export function MoneyText({ value, baseSize = 16, style, bold }: Props) {
  return (
    <ScaledText
      baseSize={baseSize}
      style={{ fontWeight: bold ? '800' : '600', ...(style as object) }}
    >
      {formatMoney(value)}
    </ScaledText>
  );
}
