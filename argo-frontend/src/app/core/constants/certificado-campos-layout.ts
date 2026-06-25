import { OrientacionCertificado, TipoCertificadoId } from './tipos-certificado';

export type CampoCertificadoId =
  | 'nombre'
  | 'tipoDoc'
  | 'doc'
  | 'expedida'
  | 'curso'
  | 'ciudad'
  | 'horas'
  | 'fecha'
  | 'vence'
  | 'acta'
  | 'folio'
  | 'runt'
  | 'obs'
  | 'certId';

export interface CampoLayoutCert {
  top?: string | null;
  left?: string;
  right?: string;
  bottom?: string | null;
  w?: string;
  align?: 'left' | 'center' | 'right';
  fs?: string;
  fw?: string;
  fontFamily?: string;
  color?: string;
  ls?: string;
  visible?: boolean;
}

export interface QrLayoutCert {
  top?: string | null;
  left?: string | null;
  right?: string | null;
  bottom?: string | null;
  /** % del ancho de la hoja (5–22). Preferido. */
  sizePct?: number;
  /** @deprecated — migrado a sizePct al leer */
  sizePx?: number;
}

export interface LayoutOrientacionCert {
  color?: string;
  campos?: Partial<Record<CampoCertificadoId, CampoLayoutCert>>;
  qr?: QrLayoutCert;
}

export type EditorSeleccion = CampoCertificadoId | 'qr';

export const QR_ESQUINAS = [
  { id: 'inferior_izquierda', label: 'Abajo izquierda' },
  { id: 'inferior_derecha', label: 'Abajo derecha' },
  { id: 'superior_izquierda', label: 'Arriba izquierda' },
  { id: 'superior_derecha', label: 'Arriba derecha' },
] as const;

export type LayoutPorTipoCert = Partial<
  Record<TipoCertificadoId, Partial<Record<OrientacionCertificado, LayoutOrientacionCert>>>
>;

export const CAMPOS_CERTIFICADO_LAYOUT: { id: CampoCertificadoId; label: string }[] = [
  { id: 'nombre', label: 'Nombre del alumno' },
  { id: 'tipoDoc', label: 'Tipo de documento (código)' },
  { id: 'doc', label: 'Número de documento' },
  { id: 'expedida', label: 'Documento expedido en' },
  { id: 'curso', label: 'Nombre del curso / encabezado' },
  { id: 'ciudad', label: 'Ciudad (constancia)' },
  { id: 'horas', label: 'Intensidad horaria' },
  { id: 'fecha', label: 'Fecha de emisión' },
  { id: 'vence', label: 'Válido hasta' },
  { id: 'acta', label: 'Número de acta' },
  { id: 'folio', label: 'Número de folio' },
  { id: 'runt', label: 'Número RUNT' },
  { id: 'obs', label: 'Observaciones' },
  { id: 'certId', label: 'Código del certificado' },
];

/** Tamaño de letra en puntos (pt) en el editor y al imprimir */
export const TAMANO_FUENTE_MIN_PT = 4;
export const TAMANO_FUENTE_MAX_PT = 48;

export interface FuenteCertificadoOption {
  label: string;
  /** Valor CSS font-family guardado en layout */
  value: string;
  googleFamily?: string;
  googleWeights?: string;
}

/** Mantener alineado con argo-backend/src/constants/certificadoFuentes.js */
export const FUENTES_CERTIFICADO: FuenteCertificadoOption[] = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  {
    label: 'Montserrat',
    value: '"Montserrat", Arial, sans-serif',
    googleFamily: 'Montserrat',
    googleWeights: '400;600;700',
  },
  {
    label: 'Open Sans',
    value: '"Open Sans", Arial, sans-serif',
    googleFamily: 'Open Sans',
    googleWeights: '400;600;700',
  },
  {
    label: 'Lato',
    value: '"Lato", Arial, sans-serif',
    googleFamily: 'Lato',
    googleWeights: '400;700',
  },
  {
    label: 'Roboto',
    value: '"Roboto", Arial, sans-serif',
    googleFamily: 'Roboto',
    googleWeights: '400;500;700',
  },
  {
    label: 'Playfair Display',
    value: '"Playfair Display", Georgia, serif',
    googleFamily: 'Playfair Display',
    googleWeights: '400;700',
  },
  {
    label: 'Merriweather',
    value: '"Merriweather", Georgia, serif',
    googleFamily: 'Merriweather',
    googleWeights: '400;700',
  },
  {
    label: 'Oswald',
    value: '"Oswald", Arial, sans-serif',
    googleFamily: 'Oswald',
    googleWeights: '400;600;700',
  },
  {
    label: 'Cinzel',
    value: '"Cinzel", Georgia, serif',
    googleFamily: 'Cinzel',
    googleWeights: '400;600;700',
  },
  {
    label: 'Great Vibes',
    value: '"Great Vibes", cursive',
    googleFamily: 'Great Vibes',
  },
  {
    label: 'Dancing Script',
    value: '"Dancing Script", cursive',
    googleFamily: 'Dancing Script',
    googleWeights: '400;700',
  },
];

export const FUENTE_CERTIFICADO_DEFAULT = FUENTES_CERTIFICADO[0].value;

export function buildGoogleFontsHref(): string {
  const parts = FUENTES_CERTIFICADO.filter((f) => f.googleFamily).map((f) => {
    const enc = f.googleFamily!.replace(/ /g, '+');
    if (f.googleWeights) return `family=${enc}:wght@${f.googleWeights}`;
    return `family=${enc}`;
  });
  if (!parts.length) return '';
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

const GOOGLE_FONTS_LINK_ID = 'argo-certificado-google-fonts';

/** Carga Google Fonts en el editor de certificados (vista previa en pantalla). */
export function ensureCertificadoGoogleFonts(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(GOOGLE_FONTS_LINK_ID)) return;
  const href = buildGoogleFontsHref();
  if (!href) return;
  const pre1 = document.createElement('link');
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(pre1);
  const pre2 = document.createElement('link');
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = 'anonymous';
  document.head.appendChild(pre2);
  const link = document.createElement('link');
  link.id = GOOGLE_FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export interface LayoutDefaultsApi {
  campos: Record<string, string>;
  vertical: Record<string, unknown>;
  horizontal: Record<string, unknown>;
  qr?: {
    vertical: Record<string, Record<string, string>>;
    horizontal: Record<string, Record<string, string>>;
    defaultSizePct: number;
    sizePctMin: number;
    sizePctMax: number;
  };
}
