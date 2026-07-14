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
  Supervisor?: { Nombre?: string; Documento?: number | string } | string;
  OrdenadorGasto?: { Nombre?: string } | string;
}

/** Registro del historial `contrato_estado` (Ágora); el último por Id es el estado vigente. */
export interface ContratoEstadoDto {
  Id?: number;
  Estado?: { Id?: number; NombreEstado?: string } | number | string;
  NombreEstado?: string;
  NumeroContrato?: string | number;
  Vigencia?: number | string;
  FechaRegistro?: string;
  Usuario?: string;
}

/** Entidad aseguradora del catálogo `entidad_aseguradora` (core_amazon_crud). */
export interface EntidadAseguradoraDto {
  Id?: number;
  Nombre?: string;
  NomAseguradora?: string;
  Descripcion?: string;
}

/** Registro de póliza (`poliza` de novedades_crud), asociado a la novedad de cesión. */
export interface PolizaDto {
  Id?: number;
  NumeroPolizaId?: string;
  EntidadAseguradoraId?: number;
  Activo?: boolean;
  IdNovedadesPoscontractuales?: { Id?: number } | number;
}

/** Respuesta de `PATCH {mid}novedad/{id}` (lib utils_oas), distinta del envoltorio Alert. */
export interface ApiResponseDto {
  Success?: boolean;
  Status?: number | string;
  Data?: unknown;
  Message?: string;
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

/**
 * Ítem de `GET novedad/{numero}/{vigencia}`; puede venir plano o anidado.
 * Las funciones `GetNovedad*` del mid agregan campos de negocio (valor de
 * adición, días de prórroga, cesionario) cuyos nombres exactos no están
 * documentados (viven en models/*.go del backend): el índice laxo permite al
 * mapper leerlos por candidatos sin acoplarse a un nombre.
 */
export interface NovedadMidDto {
  Id?: number | string;
  TipoNovedad?: number | string;
  FechaCreacion?: string;
  Estado?: string;
  Activo?: boolean;
  EnlaceDocumento?: string;
  NovedadPoscontractual?: NovedadMidDto;
  [key: string]: unknown;
}
