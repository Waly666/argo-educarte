import type { TextStyle } from 'react-native';

export const type = {
  hero: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 } satisfies TextStyle,
  h1: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 } satisfies TextStyle,
  h2: { fontSize: 18, fontWeight: '700' } satisfies TextStyle,
  h3: { fontSize: 16, fontWeight: '700' } satisfies TextStyle,
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 } satisfies TextStyle,
  caption: { fontSize: 13, fontWeight: '500' } satisfies TextStyle,
  micro: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 } satisfies TextStyle,
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' } satisfies TextStyle,
};
