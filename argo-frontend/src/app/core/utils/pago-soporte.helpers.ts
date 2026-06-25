export function tieneSoportePago(opts: {
  urlSoporte?: string | null;
  archivo?: File | null;
}): boolean {
  if (opts.archivo) return true;
  return !!String(opts.urlSoporte || '').trim();
}

export function leerImagenSoporte(
  file: File,
  onLoad: (dataUrl: string) => void,
  onError?: (msg: string) => void,
): boolean {
  if (!file.type.startsWith('image/')) {
    onError?.('Seleccione una imagen (JPG, PNG, etc.).');
    return false;
  }
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result));
  reader.readAsDataURL(file);
  return true;
}

export function tieneSoporteAdjunto(row?: { urlSoporte?: string | null } | null): boolean {
  return !!String(row?.urlSoporte || '').trim();
}

export function abrirUrlSoporte(
  url: string | null | undefined,
  onError?: (msg: string) => void,
): void {
  const u = String(url || '').trim();
  if (!u) {
    onError?.('Este movimiento no tiene soporte adjunto.');
    return;
  }
  window.open(u, '_blank', 'noopener,noreferrer');
}
