import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { usePortalBranding } from '../hooks/usePortalBranding';
import { useTheme } from '../context/ThemeContext';
import { getApiBaseUrl } from '../config/apiBase';
import { ScaledText } from './ScaledText';
import { radius, space } from '../theme/spacing';

type Props = {
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  showName?: boolean;
  nameColor?: string;
  nameSize?: number;
  variant?: 'onPrimary' | 'onCard';
  /** transparent = sin fondo (por defecto). light/dark solo si se pide explícito. */
  logoFrame?: 'transparent' | 'light' | 'dark';
  hideLetterFallback?: boolean;
};

function altLogoUrl(uri: string): string | null {
  if (!uri.includes('/uploads/')) return null;
  const origin = getApiBaseUrl().replace(/\/api\/?$/i, '');
  const path = uri.replace(/^https?:\/\/[^/]+/i, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function frameStyles(logoFrame: Props['logoFrame']) {
  if (logoFrame === 'light') {
    return { box: styles.logoBoxLight, bg: '#ffffff' };
  }
  if (logoFrame === 'dark') {
    return { box: styles.logoBoxDark, bg: '#1e293b' };
  }
  return { box: styles.logoBoxTransparent, bg: 'transparent' };
}

export function PortalLogo({
  width = 120,
  height,
  style,
  imageStyle,
  showName = false,
  nameColor = '#fff',
  nameSize = 15,
  variant = 'onPrimary',
  logoFrame = 'transparent',
  hideLetterFallback = false,
}: Props) {
  const c = useTheme();
  const { logoSource, logoUrl, nombreEmpresa, inicial, loading } = usePortalBranding();
  const [imgUri, setImgUri] = useState<string | null>(null);
  const [triedAlt, setTriedAlt] = useState(false);

  const uri = imgUri ?? logoUrl;
  const h = height ?? Math.round(width * 0.48);
  const frame = frameStyles(logoFrame);
  const imgPad = logoFrame === 'transparent' ? 0 : 12;

  useEffect(() => {
    setImgUri(null);
    setTriedAlt(false);
  }, [logoUrl]);

  const boxStyle = useMemo(
    () => [styles.logoBox, frame.box, { width, height: h, backgroundColor: frame.bg }],
    [width, h, frame],
  );

  function onImgError() {
    if (!logoUrl || triedAlt) {
      setImgUri(null);
      return;
    }
    const alt = altLogoUrl(logoUrl);
    if (alt && alt !== logoUrl) {
      setTriedAlt(true);
      setImgUri(alt);
    }
  }

  const imgSize = { width: width - imgPad, height: h - imgPad };

  function renderLogoImage(source: ImageSourcePropType, key?: string) {
    return (
      <View style={boxStyle}>
        <Image
          key={key}
          source={source}
          style={[styles.logoImg, imgSize, imageStyle]}
          resizeMode="contain"
          onError={logoUrl ? onImgError : undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {logoSource ? (
        renderLogoImage(logoSource, 'embedded')
      ) : loading ? (
        <View style={boxStyle}>
          <ActivityIndicator color={variant === 'onCard' ? c.primary : '#fff'} />
        </View>
      ) : uri ? (
        renderLogoImage({ uri }, uri)
      ) : hideLetterFallback ? (
        <View style={boxStyle}>
          <ActivityIndicator color={variant === 'onCard' ? c.primary : '#fff'} />
        </View>
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: Math.max(h, 56),
              height: Math.max(h, 56),
              backgroundColor: variant === 'onCard' ? c.accentSoft : 'rgba(255,255,255,0.15)',
              borderColor: variant === 'onCard' ? `${c.primary}33` : 'rgba(255,255,255,0.35)',
            },
          ]}
        >
          <ScaledText
            baseSize={variant === 'onCard' ? 28 : 32}
            style={{ color: variant === 'onCard' ? c.primary : '#fff', fontWeight: '800' }}
          >
            {inicial}
          </ScaledText>
        </View>
      )}
      {showName ? (
        <ScaledText baseSize={nameSize} style={[styles.name, { color: nameColor }]} numberOfLines={2}>
          {nombreEmpresa}
        </ScaledText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  logoBox: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBoxTransparent: {
    padding: 0,
  },
  logoBoxLight: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  logoBoxDark: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  logoImg: { alignSelf: 'center' },
  fallback: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  name: {
    marginTop: space.sm,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
});
