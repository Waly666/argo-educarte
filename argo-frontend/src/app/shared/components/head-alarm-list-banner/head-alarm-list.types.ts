export interface HeadAlarmListRow {
  id: string;
  title: string;
  meta?: string;
  /** Clase de tono por fila (certificado, comprobante, etc.) */
  rowClass?: string;
  routerLink?: string | string[];
  queryParams?: Record<string, string | number | boolean | null | undefined>;
}
