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
  /** Fecha de firma del contrato, anterior a la de inicio; la imprime el acta. */
  FechaSuscripcion?: string;
}

export interface ContratoGeneralDto {
  // Llega como número en unos ambientes y como string ("16387") en otros.
  Id?: number | string;
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
  UnidadEjecucion?: { Id?: number; Nombre?: string; Descripcion?: string } | string;
  /** 1 = Oficina de Contratación, otro = Ofex; define la dependencia que firma el acta. */
  UnidadEjecutora?: number | string;
  FechaRegistro?: string;
  Supervisor?: { Nombre?: string; Documento?: number | string; /** Cargo del supervisor ("JEFE DE SECCIÓN BIBLIOTECA"); el acta lo imprime como su calidad. */ Cargo?: string } | string;
  /** Id del ordenador (no su nombre) o `null` si el contrato no tiene ordenador asignado. */
  OrdenadorGasto?: { Id?: number; Nombre?: string } | string | number | null;
}

/**
 * Acta de inicio del contrato (`acta_inicio`); su `FechaInicio` es la fecha real
 * de arranque, distinta de la `FechaRegistro` de `contrato_general`.
 */
export interface ActaInicioDto {
  Id?: number;
  NumeroContrato?: number | string;
  FechaInicio?: string;
  /** Fin del período originalmente pactado; no se actualiza al registrar prórrogas. */
  FechaFin?: string;
  [key: string]: unknown;
}

/**
 * Ordenador del gasto vigente en una fecha (`ordenadores`). El contrato solo
 * guarda su `IdOrdenador`; el nombre vive aquí y cambia según el período.
 */
export interface OrdenadorDto {
  Id?: number;
  IdOrdenador?: number;
  NombreOrdenador?: string;
  RolOrdenador?: string;
  Documento?: number | string;
  /** Resolución de designación: "RESOLUCIÓN DE RECTORÍA No. 206 (06 de junio de 2023)". El acta la cita. */
  InfoResolucion?: string;
  FechaInicio?: string;
  FechaFin?: string;
}

/**
 * Persona natural (`informacion_persona_natural`), consultada por documento.
 * Da el nombre de quien elabora el acta, que el JWT no trae (solo el documento).
 */
export interface InformacionPersonaNaturalDto {
  PrimerNombre?: string;
  SegundoNombre?: string;
  PrimerApellido?: string;
  SegundoApellido?: string;
  Cargo?: string;
}

/**
 * Supervisor de una dependencia (`supervisor_contrato`). Se usa para resolver al
 * jefe de la Oficina de Contratación, que firma el acta como quien la aprueba.
 */
export interface SupervisorContratoDto {
  Nombre?: string;
  Cargo?: string;
  DependenciaSupervisor?: string;
  FechaFin?: string;
}

/**
 * Documento del gestor documental (`GET {mid}gestor_documental/{enlace}`). Las
 * claves con prefijo (`dc:`, `file:`) vienen de Nuxeo, el gestor detrás del mid.
 */
export interface GestorDocumentalDto {
  /** Nombre del archivo, p. ej. `acta_suspension_contrato_653_20268312.pdf`. */
  'dc:title'?: string;
  /** Contenido del documento en base64. */
  file?: string;
  'file:content'?: {
    'mime-type'?: string;
    name?: string;
    length?: string;
    /** URL directa en Nuxeo; no se usa (requiere sesión propia del gestor). */
    data?: string;
  };
  [key: string]: unknown;
}

/**
 * Novedad replicada en Ágora (`administrativa_amazon_api/novedad_postcontractual`).
 * Es el registro que el reinicio actualiza: su `Id` vive en Ágora y **no** coincide
 * con el de la novedad en `novedades_crud`.
 */
export interface NovedadPostcontractualArgoDto {
  Id?: number;
  NumeroContrato?: string | number;
  Vigencia?: number | string;
  PlazoEjecucion?: number | string;
  FechaInicio?: string;
  FechaFin?: string;
  FechaRegistro?: string;
  UnidadEjecucion?: number | string;
  TipoNovedad?: number | string;
}

/**
 * Histórico de CDP y RP de un contrato (`financiera_jbpm/cdprptercerocontrato`).
 * El acta imprime el **último** registro, que es el vigente.
 */
export interface CdpRpTerceroDto {
  cdp_rp_tercero?: {
    cdp_rp?: { vigencia?: string; cdp?: string; rp?: string }[];
  };
}

/** Catálogo `tipo_novedad` (novedades_crud); su `Id` alimenta la compensación de la réplica. */
export interface TipoNovedadDto {
  Id?: number;
  Nombre?: string;
  Descripcion?: string;
}

/**
 * Registro de `novedades_poscontractuales` (novedades_crud). Se lee completo para
 * poder devolverlo por PUT en la compensación (el CRUD Beego reemplaza el objeto,
 * no hace merge parcial).
 */
export interface NovedadPoscontractualDto {
  Id?: number;
  Motivo?: string;
  Activo?: boolean;
  [key: string]: unknown;
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

/** Catálogo `estado_contrato` (Ágora); da el id de un estado a partir de su nombre. */
export interface EstadoContratoDto {
  Id?: number;
  NombreEstado?: string;
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
  /** Índice laxo: la póliza se relee y se reenvía completa en el PUT (el CRUD reemplaza el objeto). */
  [key: string]: unknown;
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
  /** Fecha de expedición del acta; `FechaCreacion` es el nombre alternativo que algunos registros usan. */
  FechaExpedicion?: string;
  FechaCreacion?: string;
  Estado?: string;
  NombreEstado?: string;
  Activo?: boolean;
  EnlaceDocumento?: string;
  NovedadPoscontractual?: NovedadMidDto;
  [key: string]: unknown;
}
