# Guia de endpoints para Postman

Esta lista resume las llamadas backend que usa el flujo de `seguimientoycontrol/legal` y como replicarlas en Postman.

## Autenticacion

Todas las peticiones protegidas usan este header:

```http
Authorization: Bearer <access_token>
Accept: application/json
Content-Type: application/json
```

El `access_token` se toma de `window.localStorage` en el navegador, generado por el flujo OAuth2 del proyecto.

## Base URLs relevantes

Segun `app/scripts/environment/environment.js`, el proyecto usa estas bases:

- `ADMINISTRATIVA_PRUEBAS_SERVICE`: `https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_amazon_api/v1/`
- `NOVEDADES_MID_SERVICE`: `https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1/`
- `NOVEDADES_SERVICE`: `https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_crud/v1/`
- `DOCUMENTOS_CRUD`: `https://autenticacion.portaloas.udistrital.edu.co/apioas/documento_crud/v2/`

## Requests usadas por el modulo legal

### 1. Consultar contrato general

```http
GET /contrato_general/?query=ContratoSuscrito.NumeroContratoSuscrito:<numero_contrato>,VigenciaContrato:<vigencia>
```

Base URL:
`ADMINISTRATIVA_PRUEBAS_SERVICE`

Ejemplo:

```http
GET https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_amazon_api/v1/contrato_general/?query=ContratoSuscrito.NumeroContratoSuscrito:12345,VigenciaContrato:2026
```

### 2. Consultar estado del contrato

```http
GET /contrato_estado?query=NumeroContrato:<id>,Vigencia:<vigencia>&sortby=Id&order=desc&limit=1
```

Base URL:
`ADMINISTRATIVA_PRUEBAS_SERVICE`

### 3. Consultar informacion del proveedor por id

```http
GET /informacion_proveedor?query=Id:<id>
```

Base URL:
`ADMINISTRATIVA_PRUEBAS_SERVICE`

### 4. Consultar informacion del proveedor por documento

```http
GET /informacion_proveedor?query=NumDocumento:<documento>
```

Base URL:
`ADMINISTRATIVA_PRUEBAS_SERVICE`

### 5. Consultar estados del contrato

```http
GET /estado_contrato?query=NombreEstado:En ejecucion
```

Base URL:
`ADMINISTRATIVA_PRUEBAS_SERVICE`

### 6. Consultar novedades de un contrato

```http
GET /novedad/<numero_contrato>/<vigencia>
```

Base URL:
`NOVEDADES_MID_SERVICE`

Ejemplo:

```http
GET https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1/novedad/12345/2026
```

### 7. Consultar una novedad puntual para anularla

```http
PATCH /novedad/<id>
```

Base URL:
`NOVEDADES_MID_SERVICE`

Body:

```json
{
  "usuario": "CC123456789"
}
```

### 8. Validar cambio de estado

```http
POST /validarCambioEstado
```

Base URL:
`NOVEDADES_MID_SERVICE`

Body de ejemplo:

```json
{
  "Estado": { "Id": 3 },
  "FechaRegistro": "2026-07-05T00:00:00.000Z",
  "NumeroContrato": 123,
  "Usuario": "CC123456789",
  "Vigencia": 2026
}
```

### 9. Consultar tipo de novedad

```http
GET /tipo_novedad/?query=Id:<id>
```

Base URL:
`NOVEDADES_SERVICE`

### 10. Consultar documento en gestor documental

```http
GET /gestor_documental/<enlace>
```

Base URL:
`NOVEDADES_MID_SERVICE`

## Ejemplo de coleccion en Postman

Si quieres armarlo rapido, crea una variable de entorno en Postman:

- `base_admin = https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_amazon_api/v1`
- `base_novedades_mid = https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1`
- `base_novedades = https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_crud/v1`

Y usa requests como:

```http
{{base_admin}}/contrato_general/?query=ContratoSuscrito.NumeroContratoSuscrito:12345,VigenciaContrato:2026
{{base_novedades_mid}}/novedad/12345/2026
{{base_novedades_mid}}/novedad/99999
```

## Nota

El archivo que activa estas URLs en el proyecto es `app/scripts/environment/environment.js`, que define `CONF.GENERAL`.
