import { useMemo } from 'react';

import { APP_BRANDING } from '../config/appBranding';
import { usePortalConfig } from '../context/PortalConfigContext';

export function usePortalBranding() {
  const { config, loading: configLoading } = usePortalConfig();

  return useMemo(() => {
    const nombreEmpresa = config?.nombreCea?.trim() || APP_BRANDING.nombreEmpresa;
    const tituloApp = APP_BRANDING.tituloApp;
    const logoSource = APP_BRANDING.logo;
    const logoUrl =
      config?.urlLogoAbsoluta?.trim() ||
      config?.urlLogo?.trim() ||
      null;
    const inicial = nombreEmpresa.charAt(0).toUpperCase() || 'E';

    return {
      config,
      /** La marca visual no espera al servidor. */
      loading: false,
      configLoading,
      tituloApp,
      nombreEmpresa,
      logoSource,
      logoUrl,
      inicial,
    };
  }, [config, configLoading]);
}
