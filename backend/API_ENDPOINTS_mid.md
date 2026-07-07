# API `novedades_mid`

Servicio Go (Beego v1.12.3). Prefijo base de todas las rutas: **`/v1`**.
Puerto configurado vía env var `NOVEDADES_API_HTTP_PORT` (`conf/app.conf`).

Envoltorio de respuesta usado por casi todos los endpoints:

```json
// models.Alert
{
  "Type": "OK | ERROR",
  "Code": "200 | 201 | 400 | 404 | 500",
  "Body": { }
}
```

La excepción es `PATCH /v1/novedad/:id`, que responde con `requestresponse.APIResponse` (lib `utils_oas`): `{ Success, Status, Data, Message }`.

## Middleware global (`main.go`)

- CORS (`*` en dev, `*.udistrital.edu.co` en prod)
- AWS X-Ray tracing
- Auditoría (`utils_oas/auditoria`)
- Security headers (`utils_oas/security`)
- **Sin auth propia**: reenvía el header `Authorization` recibido hacia los microservicios downstream (auth se asume resuelta por un gateway externo)
- Job en background (`models.Temporizador`, cada 30 min) que auto-replica novedades vencidas

---

## Índice de endpoints

| Método | Path | Controller.Method |
|---|---|---|
| POST | `/v1/validarCambioEstado/` | CambioEstadoContratoValidoController.ValidarCambioEstado |
| POST | `/v1/registro_novedad/` | RegistroNovedadController.PostRegistroNovedad |
| POST | `/v1/novedad/` | NovedadesController.Post |
| GET | `/v1/novedad/` | NovedadesController.GetAll |
| GET | `/v1/novedad/:id/:vigencia` | NovedadesController.GetOne |
| PUT | `/v1/novedad/:id/:vigencia` | NovedadesController.Put |
| DELETE | `/v1/novedad/:id` | NovedadesController.Delete |
| PATCH | `/v1/novedad/:id` | NovedadesController.Patch |
| POST | `/v1/replica/` | ReplicaController.Post |
| GET | `/v1/replica/` | ReplicaController.GetAll |
| GET | `/v1/replica/:id` | ReplicaController.GetOne |
| PUT | `/v1/replica/:id` | ReplicaController.Put |
| DELETE | `/v1/replica/:id` | ReplicaController.Delete |
| POST | `/v1/gestor_documental/` | GestorDocumentalController.Post |
| GET | `/v1/gestor_documental/:enlace` | GestorDocumentalController.GetOne |
| PUT | `/v1/gestor_documental/:url` | GestorDocumentalController.Put |

---

## Cambio de estado de contrato

### `POST /v1/validarCambioEstado/`
Endpoint de doble modo: valida/aplica un cambio de estado de contrato.

**Body** (intenta parsear en este orden):
1. `models.EstadoContrato[]`
```json
[{ "NombreEstado": "string", "FechaRegistro": "2026-01-01T00:00:00Z", "Id": 1 }]
```
2. Si falla, `models.CambioEstado`:
```json
{
  "Estado": { "Id": 1 },
  "FechaRegistro": "string",
  "NumeroContrato": "string",
  "Usuario": "string",
  "Vigencia": 2026
}
```

**Respuesta:** `models.Alert`
- `201` si valida vía `AdminMidApi + /validarCambioEstado` (modo array)
- `200` si activa vía `AdministrativaAmazonService + /contrato_estado` (modo mapa)
- `400` si falla el unmarshal o la llamada downstream

---

## Registro de novedad (legado / Mongo)

### `POST /v1/registro_novedad/`
**Body:** `map[string]interface{}` libre (payload de novedad sin esquema fijo).

**Respuesta:** `models.Alert`

**Lógica:** agrega `fecharegistro` (hora Bogotá) y reenvía tal cual a un microservicio Mongo (`NovedadesApiMongoService/v1/novedad`). Es un almacenamiento paralelo al de `/v1/novedad` (Postgres).

> ⚠️ Bug conocido: el chequeo de éxito revisa el error del `unmarshal` (siempre nil), no el de la llamada downstream, así que casi siempre reporta `Type: "OK"` aunque el POST a Mongo falle.

---

## Novedades (CRUD principal — Postgres vía CRUD service)

### `POST /v1/novedad/`
**Body:** `map[string]interface{}` con discriminador `"tiponovedad"`: `NP_SUS`, `NP_CES`, `NP_REI`, `NP_TER`, `NP_ADI`, `NP_PRO`, `NP_ADPRO`. Campos varían según tipo (ver `models/adicion.go`, `cesion.go`, etc.).

**Respuesta:** `models.Alert` — `200` con body = respuesta del CRUD service, `400` en error.

**Lógica:** construye el payload específico del tipo, enriquece con datos de contrato/estado, y hace POST a `NovedadesCrudService/trNovedad` (o `/trNovedad/trnovedadpoliza` para cesión).

### `GET /v1/novedad/`
Query params documentados (`query`, `fields`, `sortby`, `order`, `limit`, `offset`) — **sin implementar realmente**: siempre devuelve `{Type:"OK", Code:"200", Body: nil}` (llamada real está comentada en el código).

### `GET /v1/novedad/:id/:vigencia`
**Params path:** `id` (contrato), `vigencia` (año).

**Respuesta:** `models.Alert`, body = arreglo de novedades formateadas según tipo (`GetNovedad{Suspension,Cesion,Reinicio,TAnticipada,Adicion,Prorroga,AdProrroga}`).

**Lógica:** consulta `NovedadesCrudService/novedades_poscontractuales/?query=contrato_id:{id},vigencia:{vigencia},activo:true`, ordena por `FechaCreacion`, formatea según `TipoNovedad` (1=suspensión, 2=cesión, 3=reinicio, 5=terminación anticipada, 6=adición, 7=prórroga, 8=adición/prórroga).

### `PUT /v1/novedad/:id/:vigencia`
**Params path:** `id`. **Body:** `map[string]interface{}` (solo se valida que parsee, no se usa el contenido).

**Respuesta:** `models.Alert`.

**Lógica:** obtiene la novedad, fuerza `Estado = "TERMINADA"` y la actualiza. ⚠️ Siempre retorna éxito (`Body: nil`) sin importar el resultado real.

### `DELETE /v1/novedad/:id`
**Params path:** `id`.

**Respuesta:** `models.Alert`.

**Lógica:** elimina en cascada: `fechas`, `propiedad`, y (si `TipoNovedad==2`) `poliza`, luego la novedad. Cualquier falla parcial aborta y retorna el sub-recurso que falló.

### `PATCH /v1/novedad/:id` — el más reciente / con lógica más activa
**Params path:** `id`. **Body opcional:**
```json
{ "usuario": "string" }
```
También lee header `X-User` como fallback (prefija `CC` si no es ya un tipo de documento), default `"MID"`.

**Respuesta:** `requestresponse.APIResponse` (`{ Success, Status, Data, Message }`), distinto del resto de endpoints.

**Lógica:** `AnularNovedadYRevertirEstado(id, usuario)` — flujo de "anular novedad":
1. Obtiene `models.Novedad` por id.
2. Resuelve número de contrato en Administrativa Amazon.
3. Revierte estado de contrato dos veces (estado 10 → estado 4).
4. Determina novedad "top" y anterior para calcular fechas de restitución.
5. Marca `Activo=false` y actualiza.
6. Elimina el registro `novedad_postcontractual` en Amazon.
7. Ajusta/elimina en cascada filas relacionadas en Titan (CP/detalle), revierte `ValorContrato`.
8. Regenera preliquidación (`ReplicafechaAnterior`).
9. Retorna JSON combinado: `novedad_anulada`, `amazon_eliminada`, `cambios_estado`, `titan.{contrato_updates, contratos_eliminados, contratos_extra_cp_eliminados, replica}`.

---

## Réplica (Titan / Administrativa Amazon)

### `POST /v1/replica/`
**Body:** `map[string]interface{}` con flag `esFechaActual`:
- `true` → payload completo tipo `models.PreliquidacionReplica`:
```json
{
  "NumeroContrato": "string",
  "Vigencia": 2026,
  "FechaRegistro": "string",
  "Contratista": "string",
  "PlazoEjecucion": "string",
  "FechaInicio": "string",
  "FechaFin": "string",
  "UnidadEjecucion": "string",
  "TipoNovedad": 216,
  "NumeroCdp": "string",
  "VigenciaCdp": 2026,
  "ValorNovedad": 0,
  "Documento": "string (según tipo)",
  "DocumentoActual": "string (según tipo)",
  "DocumentoNuevo": "string (según tipo)",
  "NombreCompleto": "string (según tipo)"
}
```
- `false` → cuerpo ignorado; solo relanza el timer en background (`models.Temporizador`).

**Respuesta:** `models.Alert` — `200` (body incluye `alertas[]`), `400` en error.

**Lógica:** si `esFechaActual==true`, replica de inmediato según `TipoNovedad` hacia Titan (216=suspender, 219=ceder, 220=otrosí, 218=cancelar).

### `GET /v1/replica/`
**Stub vacío** — no hace nada, ni responde JSON.

### `GET /v1/replica/:id`
**Params path:** `id` (id de workflow jBPM).

**Respuesta:** `models.Alert` — solo soporta `TipoNovedad` 8 (adición/prórroga) o 2 (cesión); si no, `400` con mensaje `"La novedad no es de adición/prórroga o cesión"`.

**Lógica:** consulta jBPM (`jbpmService/services/bodega_temporal.HTTPEndpoint/novedad/{id}`), extrae `novedad_id`, y re-obtiene/formatea la novedad real desde `NovedadesCrudService`.

### `PUT /v1/replica/:id`
**Params path:** `id`. **Body:** `map[string]interface{}` — solo procesa si `TipoNovedad == 216` (reinicio tras suspensión).

**Respuesta:** `models.Alert`.

**Lógica:** `models.ReplicaReinicio(novedad, id)` — PUT a `AdministrativaAmazonService/novedad_postcontractual/{id}`, luego POST a `TitanMidService/novedadCPS/reiniciar_contrato`.

### `DELETE /v1/replica/:id`
**Stub vacío** — sin lógica.

---

## Gestor documental (proxy a Nuxeo)

### `GET /v1/gestor_documental/:enlace`
**Params path:** `enlace` (id/link del documento).

**Respuesta:** `models.Alert` — body = respuesta de Nuxeo; `500` si Nuxeo responde `Status=="500"`, `400` si falla el GET, `200` en éxito.

### `POST /v1/gestor_documental/`
**Body:** `[]map[string]interface{}` (payload libre de registro de documento).

**Respuesta:** `models.Alert` — `200`/`400`.

**Lógica:** `RegistrarDoc(doc, "upload")` → POST a `GestorDocumentalMid/document/upload`.

### `PUT /v1/gestor_documental/:url`
**Params path:** `url` (⚠️ recibido pero no usado en el handler).

**Body:** `[]map[string]interface{}`.

**Respuesta:** `models.Alert` — `200`/`400`.

**Lógica:** `RegistrarDoc(doc, "firma_electronica")` → POST a `GestorDocumentalMid/document/firma_electronica`.

---

## Modelos principales (`models/`)

| Struct | Campos |
|---|---|
| `Alert` | `Type string, Code string, Body interface{}` |
| `EstadoContrato` | `NombreEstado string, FechaRegistro time.Time, Id int` |
| `CambioEstado` | `Estado{Id int}, FechaRegistro string, NumeroContrato string, Usuario string, Vigencia int` |
| `Novedad` | `Id, NumeroSolicitud, ContratoId, NumeroCdpId, Motivo, Aclaracion, Observacion, Vigencia, VigenciaCdp, FechaCreacion, FechaModificacion, Activo, TipoNovedad, OficioSupervisor, OficioOrdenador, Estado, EnlaceDocumento` |
| `Predicado` | `Id int, Nombre string, Descripcion string` |
| `JbpmReplica` | `NovedadReplicaCollection.novedad_replica[]{id, ArgonovedadId, NovedadId, Activo, FechaCreacion, FechaModificacion}` |
| `PreliquidacionReplica` | `Activo, Cdp, Completo, DependenciaId, Desagregado, Documento, FechaCreacion, FechaFin, FechaInicio, FechaModificacion, Id, NombreCompleto, NumeroContrato, NumeroSemanas, PersonaId, ProyectoId, Resolucion, ResolucionId, Rp, TipoNominaId, Unico, Vacaciones, ValorContrato, Vigencia, VigenciaCdp` |
| `InformacionContratosPersona` | `ContratosPersonas.ContratoPersona[]{TipoContrato:{Nombre,Id}, Vigencia, NumeroContrato, EstadoContrato:{Nombre,Id}}` |
| `InformacionProveedor` | `Id, Tipopersona, NumDocumento, IdCiudadContacto, Direccion, Correo, Web, NomAsesor, TelAsesor, Descripcion, PuntajeEvaluacion, ClasificacionEvaluacion, Estado, TipoCuentaBancaria, NumCuentaBancaria, IdEntidadBancaria, FechaRegistro, FechaUltimaModificacion, NomProveedor, Anexorut, Anexorup, RegimenContributivo` |
| `ParametroEstandar` | `Id int, ClaseParametro string, ValorParametro string, DescripcionParametro string` |

Los tipos de novedad (`adicion.go`, `cesion.go`, `prorroga.go`, `reinicio.go`, `suspension.go`, `terminacionanticipada.go`, `adicionprorroga.go`) no son structs — son funciones `Construir*`/`Get*` que arman/leen `map[string]interface{}` representando `NovedadPoscontractual + Fechas + Propiedad (+ Poliza para cesión)`, con códigos numéricos por tipo (ej. `FechaSolicitud=7`, `FechaAdicion=1`, `Cesionario=2`, `PeriodoSuspension=3`, etc.).

## Servicios downstream (env vars en `conf/app.conf`)

`NovedadesApiMongoService`, `NovedadesCrudService`, `AdministrativaAmazonService`, `jbpmService`, `TitanMidService`, `ParametrosCrudService`, `TitanCrudService`, `GestorDocumentalMid`, `AdminMidApi`.
