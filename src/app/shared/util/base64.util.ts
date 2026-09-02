/**
 * Base64 → Blob, para materializar en memoria un documento que el backend
 * devuelve dentro de un JSON (ni el gestor documental ni el servicio de actas
 * sirven el archivo por URL).
 *
 * Tolera que el contenido venga con prefijo `data:...;base64,`.
 */
export function base64ToBlob(base64: string, mimeType = 'application/pdf'): Blob {
  const limpio = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const bytes = Uint8Array.from(atob(limpio), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}
