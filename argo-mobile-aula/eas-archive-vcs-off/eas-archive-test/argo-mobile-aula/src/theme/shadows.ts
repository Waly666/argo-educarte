import type { ViewStyle } from 'react-native';

export const shadow = {
  sm: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } satisfies ViewStyle,
  md: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  } satisfies ViewStyle,
  lg: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  } satisfies ViewStyle,
};
