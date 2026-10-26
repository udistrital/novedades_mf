/**
 * Acta de una novedad tal como la entrega el gestor documental: contenido y
 * metadatos mínimos para poder mostrarla.
 *
 * Es dato puro (sin tipos del navegador): convertirlo a Blob o a una URL
 * visualizable es tarea de la capa que lo presenta.
 */
export interface NoveltyDocument {
  /** Nombre del archivo, p. ej. `acta_suspension_contrato_653_20268312.pdf`. */
  fileName: string;
  /** Tipo MIME reportado por el gestor documental (normalmente `application/pdf`). */
  mimeType: string;
  /** Contenido del archivo en base64, sin el prefijo `data:`. */
  base64: string;
}
