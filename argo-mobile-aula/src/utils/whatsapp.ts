/** Enlace wa.me — misma lógica que argo-aula-virtual shell.component.ts */

export function whatsappHref(telefono?: string | null): string | null {
  const raw = telefono?.trim() || '';
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const withCountry = digits.startsWith('57') ? digits : `57${digits}`;
  return `https://wa.me/${withCountry}`;
}

export function whatsappTelefono(config?: { telefono?: string | null; telefonoWhatsapp?: string | null } | null): string {
  return config?.telefono?.trim() || config?.telefonoWhatsapp?.trim() || '';
}
