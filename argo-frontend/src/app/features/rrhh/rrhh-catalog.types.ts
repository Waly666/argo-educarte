export interface RrhhCatalogField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select';
  required?: boolean;
  col?: number;
  options?: { value: string; label: string }[];
}

export interface RrhhCatalogConfig {
  titulo: string;
  hint?: string;
  apiPath: string;
  idKey: string;
  labelKey?: string;
  fields: RrhhCatalogField[];
  columns: { key: string; label: string }[];
}
