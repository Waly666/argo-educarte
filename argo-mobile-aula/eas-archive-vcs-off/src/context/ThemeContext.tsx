import React, { useMemo } from 'react';

import { usePortalConfig } from './PortalConfigContext';
import { themeForVariant, type ThemeColors, type ThemeVariant } from '../theme/colors';

const ThemeContext = React.createContext<ThemeColors>(themeForVariant('public'));

type Props = {
  children: React.ReactNode;
  variant?: ThemeVariant;
};

export function ThemeProvider({ children, variant = 'public' }: Props) {
  const { config } = usePortalConfig();
  const colors = useMemo(
    () => themeForVariant(variant, config?.site?.tema),
    [variant, config?.site?.tema],
  );

  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeColors {
  return React.useContext(ThemeContext);
}
