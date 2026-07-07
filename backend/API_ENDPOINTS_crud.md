# API — novedades_crud

Backend Go/Beego + PostgreSQL (ORM `astaxie/beego/orm`). Base path: **`/v1`**.

CORS habilitado para `*.udistrital.edu.co` (métodos PUT, PATCH, GET, POST, OPTIONS, DELETE).

Todos los recursos, salvo `trNovedad`, siguen el mismo patrón CRUD genérico (scaffold de Beego):
`POST /` (crear) · `GET /` (listar) · `GET /:id` (uno) · `PUT /:id` (actualizar) · `DELETE /:id` (eliminar).

## Parámetros comunes de listado (`GET /`)

| Query param | Descripción | Default |
|---|---|---|
| `query` | Filtro `campo:valor,campo:valor` (soporta notación punto para relaciones) | - |
| `fields` | Proyección de columnas, separadas por coma | todas |
| `sortby` | Columna(s) de orden | - |
| `order` | `asc` / `desc` | `asc` |
| `limit` | Máximo de resultados | `10` |
| `offset` | Desplazamiento | `0` |

## Convención de errores

En error el controlador setea `Data["system"] = err` y aborta con el código HTTP correspondiente (`400` o `404`); el body final de error lo formatea el `CustomErrorController` (paquete externo `udistrital/utils_oas`, no incluido en este repo).

---

## 1. `/v1/fechas` — Fechas

Fecha (con su tipo) asociada a una novedad poscontractual.

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/fechas/` | `Fechas` (JSON) | `201` + objeto creado | |
| GET | `/v1/fechas/` | – | `200` + `Fechas[]` | `404` si falla el query |
| GET | `/v1/fechas/:id` | – | `200` + `Fechas` | `404` si no existe |
| PUT | `/v1/fechas/:id` | `Fechas` (campos a actualizar) | `200` + objeto actualizado | `400` en error |
| DELETE | `/v1/fechas/:id` | – | `200` + `{"Id": <id>}` | `404` si no existe |

```go
type Fechas struct {
    Id                          int
    Fecha                       string // timestamp
    Activo                      bool
    FechaCreacion               string // timestamp
    FechaModificacion           string // timestamp
    IdTipoFecha                 *TipoFecha                 // FK
    IdNovedadesPoscontractuales *NovedadesPoscontractuales // FK
}
```

---

## 2. `/v1/novedades_poscontractuales` — Novedades Poscontractuales

Entidad central: evento/cambio poscontractual sobre un contrato.

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/novedades_poscontractuales/` | `NovedadesPoscontractuales` | `201` + objeto creado | |
| GET | `/v1/novedades_poscontractuales/` | – | `200` + array | |
| GET | `/v1/novedades_poscontractuales/:id` | – | `200` + objeto | `404` si no existe |
| PUT | `/v1/novedades_poscontractuales/:id` | `NovedadesPoscontractuales` | `200` + objeto | `FechaModificacion` se sobrescribe en servidor (hora Bogotá) |
| DELETE | `/v1/novedades_poscontractuales/:id` | – | `200` + `{"Id": <id>}` | |

```go
type NovedadesPoscontractuales struct {
    Id                int
    NumeroSolicitud   string
    ContratoId        int
    NumeroCdpId       int
    Motivo            string
    Aclaracion        string
    Observacion       string
    Vigencia          int
    VigenciaCdp       int
    FechaCreacion     string // auto_now_add
    FechaModificacion string // auto_now
    Activo            bool
    TipoNovedad       int
    OficioSupervisor  string
    OficioOrdenador   string
    Estado            string
    EnlaceDocumento   string
}
```

---

## 3. `/v1/poliza` — Póliza

Póliza de seguro ligada a una novedad.

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/poliza/` | `Poliza` | `201` + objeto creado | |
| GET | `/v1/poliza/` | – | `200` + array | |
| GET | `/v1/poliza/:id` | – | `200` + objeto | `404` si no existe |
| PUT | `/v1/poliza/:id` | `Poliza` | `200` + objeto | `FechaModificacion` pre-seteada en servidor (hora Bogotá), sobreescribible por el body |
| DELETE | `/v1/poliza/:id` | – | `200` + `{"Id": <id>}` | |

```go
type Poliza struct {
    Id                          int
    NumeroPolizaId              string
    EntidadAseguradoraId        int
    FechaCreacion               string
    FechaModificacion           string
    Activo                      bool
    IdNovedadesPoscontractuales *NovedadesPoscontractuales // FK
}
```

---

## 4. `/v1/propiedad` — Propiedad

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/propiedad/` | `Propiedad` | `201` + objeto creado | |
| GET | `/v1/propiedad/` | – | `200` + array | |
| GET | `/v1/propiedad/:id` | – | `200` + objeto | `404` si no existe |
| PUT | `/v1/propiedad/:id` | `Propiedad` | `200` + objeto | |
| DELETE | `/v1/propiedad/:id` | – | `200` + `{"Id": <id>}` | |

```go
type Propiedad struct {
    Id                          int
    Propiedad                   int
    Activo                      bool
    FechaCreacion               string
    FechaModificacion           string
    IdTipoPropiedad             *TipoPropiedad             // FK
    IdNovedadesPoscontractuales *NovedadesPoscontractuales // FK
}
```

---

## 5. `/v1/tipo_fecha` — Tipo de Fecha (catálogo)

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/tipo_fecha/` | `TipoFecha` | `201` + objeto creado | Timestamps seteados en servidor; tiene un `fmt.Println` de debug residual |
| GET | `/v1/tipo_fecha/` | – | `200` + array | |
| GET | `/v1/tipo_fecha/:id` | – | `200` + objeto | `404` si no existe |
| PUT | `/v1/tipo_fecha/:id` | `TipoFecha` | `200` + objeto | |
| DELETE | `/v1/tipo_fecha/:id` | – | `200` + `{"Id": <id>}` | |

```go
type TipoFecha struct {
    Id                int
    Nombre            string
    Descripcion       string
    CodigoAbreviacion string
    Activo            bool
    NumeroOrden       float64
    FechaCreacion     string
    FechaModificacion string
    TipoNovedad       int
}
```

---

## 6. `/v1/tipo_novedad` — Tipo de Novedad (catálogo)

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/tipo_novedad/` | `TipoNovedad` | `201` + objeto creado | Timestamps seteados en servidor |
| GET | `/v1/tipo_novedad/` | – | `200` + array | |
| GET | `/v1/tipo_novedad/:id` | – | `200` + objeto | `404` si no existe |
| PUT | `/v1/tipo_novedad/:id` | `TipoNovedad` | `200` + objeto | |
| DELETE | `/v1/tipo_novedad/:id` | – | `200` + `{"Id": <id>}` | |

```go
type TipoNovedad struct {
    Id                int
    Nombre            string
    Descripcion       string
    CodigoAbreviacion string
    Activo            bool
    NumeroOrden       float64
    FechaCreacion     string
    FechaModificacion string
}
```

---

## 7. `/v1/tipo_propiedad` — Tipo de Propiedad (catálogo)

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/tipo_propiedad/` | `TipoPropiedad` | `201` + objeto creado | Timestamps seteados en servidor |
| GET | `/v1/tipo_propiedad/` | – | `200` + array | |
| GET | `/v1/tipo_propiedad/:id` | – | `200` + objeto | `404` si no existe |
| PUT | `/v1/tipo_propiedad/:id` | `TipoPropiedad` | `200` + objeto | |
| DELETE | `/v1/tipo_propiedad/:id` | – | `200` + `{"Id": <id>}` | |

```go
type TipoPropiedad struct {
    Id                int
    Nombre            string
    Descripcion       string
    CodigoAbreviacion string
    Activo            bool
    NumeroOrden       float64
    FechaCreacion     string
    FechaModificacion string
    TipoNovedad       int16
}
```

---

## 8. `/v1/trNovedad` — Transacción Novedad Poscontractual (custom)

No es CRUD genérico: inserta varias tablas relacionadas en una sola transacción de BD.

| Método | Ruta | Body | Respuesta OK | Notas |
|---|---|---|---|---|
| POST | `/v1/trNovedad/` | `TrNovedadesPoscontractuales` | `201` + objeto con `NovedadPoscontractual.Id` asignado | Inserta 1 `NovedadesPoscontractuales` + sus `Fechas[]` + `Propiedad[]` en una transacción (rollback si falla algo) |
| POST | `/v1/trNovedad/trnovedadpoliza/` | `TrNovedadesPoscontractualesPoliza` | `201` + objeto con Id asignado | Igual al anterior + inserta `Poliza[]`. `400` con `{"system": err}` en error |
| PUT | `/v1/trNovedad/:id` | – | – | **No-op**: cuerpo del método está comentado, no hace nada |
| DELETE | `/v1/trNovedad/:id` | – | – | **No-op / posiblemente ni registrado**: cuerpo comentado y falta en la tabla de rutas autogenerada |

```go
type TrNovedadesPoscontractuales struct {
    NovedadPoscontractual *NovedadesPoscontractuales
    Fechas                *[]Fechas
    Propiedad             *[]Propiedad
}

type TrNovedadesPoscontractualesPoliza struct {
    NovedadPoscontractual *NovedadesPoscontractuales
    Fechas                *[]Fechas
    Propiedad             *[]Propiedad
    Poliza                *[]Poliza
}
```

Los timestamps (`FechaCreacion`/`FechaModificacion`) de todas las filas insertadas (padre e hijos) se setean en servidor con hora de Bogotá.

---

## Resumen plano de endpoints

| # | Método | Ruta | Handler |
|---|---|---|---|
| 1 | POST | `/v1/fechas/` | FechasController.Post |
| 2 | GET | `/v1/fechas/` | FechasController.GetAll |
| 3 | GET | `/v1/fechas/:id` | FechasController.GetOne |
| 4 | PUT | `/v1/fechas/:id` | FechasController.Put |
| 5 | DELETE | `/v1/fechas/:id` | FechasController.Delete |
| 6 | POST | `/v1/novedades_poscontractuales/` | NovedadesPoscontractualesController.Post |
| 7 | GET | `/v1/novedades_poscontractuales/` | NovedadesPoscontractualesController.GetAll |
| 8 | GET | `/v1/novedades_poscontractuales/:id` | NovedadesPoscontractualesController.GetOne |
| 9 | PUT | `/v1/novedades_poscontractuales/:id` | NovedadesPoscontractualesController.Put |
| 10 | DELETE | `/v1/novedades_poscontractuales/:id` | NovedadesPoscontractualesController.Delete |
| 11 | POST | `/v1/poliza/` | PolizaController.Post |
| 12 | GET | `/v1/poliza/` | PolizaController.GetAll |
| 13 | GET | `/v1/poliza/:id` | PolizaController.GetOne |
| 14 | PUT | `/v1/poliza/:id` | PolizaController.Put |
| 15 | DELETE | `/v1/poliza/:id` | PolizaController.Delete |
| 16 | POST | `/v1/propiedad/` | PropiedadController.Post |
| 17 | GET | `/v1/propiedad/` | PropiedadController.GetAll |
| 18 | GET | `/v1/propiedad/:id` | PropiedadController.GetOne |
| 19 | PUT | `/v1/propiedad/:id` | PropiedadController.Put |
| 20 | DELETE | `/v1/propiedad/:id` | PropiedadController.Delete |
| 21 | POST | `/v1/tipo_fecha/` | TipoFechaController.Post |
| 22 | GET | `/v1/tipo_fecha/` | TipoFechaController.GetAll |
| 23 | GET | `/v1/tipo_fecha/:id` | TipoFechaController.GetOne |
| 24 | PUT | `/v1/tipo_fecha/:id` | TipoFechaController.Put |
| 25 | DELETE | `/v1/tipo_fecha/:id` | TipoFechaController.Delete |
| 26 | POST | `/v1/tipo_novedad/` | TipoNovedadController.Post |
| 27 | GET | `/v1/tipo_novedad/` | TipoNovedadController.GetAll |
| 28 | GET | `/v1/tipo_novedad/:id` | TipoNovedadController.GetOne |
| 29 | PUT | `/v1/tipo_novedad/:id` | TipoNovedadController.Put |
| 30 | DELETE | `/v1/tipo_novedad/:id` | TipoNovedadController.Delete |
| 31 | POST | `/v1/tipo_propiedad/` | TipoPropiedadController.Post |
| 32 | GET | `/v1/tipo_propiedad/` | TipoPropiedadController.GetAll |
| 33 | GET | `/v1/tipo_propiedad/:id` | TipoPropiedadController.GetOne |
| 34 | PUT | `/v1/tipo_propiedad/:id` | TipoPropiedadController.Put |
| 35 | DELETE | `/v1/tipo_propiedad/:id` | TipoPropiedadController.Delete |
| 36 | POST | `/v1/trNovedad/` | Tr_novedad_poscontractualController.Post |
| 37 | POST | `/v1/trNovedad/trnovedadpoliza/` | Tr_novedad_poscontractualController.PostPoliza |
| 38 | PUT | `/v1/trNovedad/:id` | Tr_novedad_poscontractualController.Put (no-op) |
| 39 | DELETE | `/v1/trNovedad/:id` | Tr_novedad_poscontractualController.Delete (no-op) |
