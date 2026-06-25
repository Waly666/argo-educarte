export function reciboEgresoHtmlPath(idEgreso: string): string {
  return `/egresos/${encodeURIComponent(idEgreso)}/recibo/html?v=${Date.now()}`;
}
