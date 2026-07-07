/**
 * Respuestas de las APIs institucionales legadas (administrativa_amazon_api y
 * novedades_mid). El esquema no está documentado campo a campo (ver backend/*.md),
 * por eso los campos son opcionales/laxos y el mapper lee con alternativas.
 * Cualquier ajuste de nombre de campo tras validar contra el servicio real se
 * hace aquí y en contract.mapper.ts, en ningún otro lado.
 */

export interface ContratoSuscritoDto {
  Id?: number;
  NumeroContratoSuscrito?: string | number;
  Vigencia?: number | string;
}

export interface ContratoGeneralDto {
  Id?: number;
  // El backend devuelve la relación como arreglo (normalmente de un solo elemento).
  ContratoSuscrito?: ContratoSuscritoDto[];
  NumeroContrato?: string | number;
  VigenciaContrato?: number | string;
  Vigencia?: number | string;
  TipoContrato?: { Nombre?: string; TipoContrato?: string } | string;
  Contratista?: number | string | { Id?: number };
  ValorContrato?: number | string;
  Valor?: number | string;
  ObjetoContrato?: string;
  Objeto?: string;
  PlazoEjecucion?: number | string;
  UnidadEjecucion?: { Nombre?: string } | string;
  FechaRegistro?: string;
  Supervisor?: { Nombre?: string } | string;
  OrdenadorGasto?: { Nombre?: string } | string;
}

export interface InformacionProveedorDto {
  Id?: number;
  NumDocumento?: string | number;
  NomProveedor?: string;
  Tipopersona?: string;
}

/** Envoltorio estándar de respuesta de novedades_mid. */
export interface AlertResponse<T> {
  Type?: string;
  Code?: string;
  Body?: T;
}

/** Ítem de `GET novedad/{numero}/{vigencia}`; puede venir plano o anidado. */
export interface NovedadMidDto {
  Id?: number | string;
  TipoNovedad?: number | string;
  FechaCreacion?: string;
  Estado?: string;
  Activo?: boolean;
  EnlaceDocumento?: string;
  NovedadPoscontractual?: NovedadMidDto;
}
