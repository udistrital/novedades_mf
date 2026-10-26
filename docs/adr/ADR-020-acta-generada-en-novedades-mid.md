# ADR-020 — El acta se genera con `POST novedad/generaracta` de `novedades_mid`

**Fecha**: 2026-10-09 · **Estado**: Aceptada (reemplaza en [ADR-016](ADR-016-generacion-de-actas-desacoplada.md) el servicio que implementa el puerto; el puerto sigue vigente)

## Contexto

[ADR-016](ADR-016-generacion-de-actas-desacoplada.md) puso la generación del acta detrás del
puerto `IActaGenerator` porque el servicio que la implementaba, **`actas_novedad_mid`** (FastAPI,
un endpoint por tipo de acta, `localhost:8080`), era temporal y su reemplazo estaba anunciado.

El reemplazo llegó el 2026-10-05: el generador pasó a **`novedades_mid`**, el mismo middleware que
el MF ya consume para registrar novedades, como un solo endpoint para las cinco actas:

```http
POST {mid}novedad/generaracta
{ "tipo_acta": "suspension" | "reinicio" | "adicion_prorroga" | "cesion" | "terminacion_liquidacion",
  "datos": { "contrato": { … }, … } }
```

`datos` es exactamente el body que recibía cada endpoint del FastAPI, y la respuesta 200 es la
misma (`{success, filename, file_base64, metadata}`). Cambian tres cosas:

1. **Un endpoint en vez de cinco**: el tipo de acta viaja en el cuerpo, con guion bajo.
2. **Tipos JSON estrictos** (Go): un tipo equivocado en cualquier campo —un documento numérico,
   un entero con decimales, una fecha con hora— invalida todo `datos` con un único 422
   `campo: "datos"`, `estructura inválida: …`. Los campos con nombre desconocido se ignoran en
   silencio.
3. **Formato de los errores**: los 422 traen `detail: [{campo, mensaje}]` (antes
   `[{loc, msg, type}]` de Pydantic); los 400 y 500, solo `{success, error}`.

El endpoint vive en la rama `feature/actas` de `novedades_mid` y **todavía no está desplegado**:
el `novedades_mid` institucional responde 404 a esa ruta.

## Decisión

### El cambio no sale de `infrastructure/`

Tal como lo previó ADR-016, se reescribe la implementación existente del puerto en vez de
agregar otra: `HttpActaMidService` y `acta-payload.mapper.ts` siguen siendo los dos únicos
archivos que conocen el generador.

| Archivo | Qué cambió |
|---|---|
| `infrastructure/mappers/acta-payload.mapper.ts` | La tabla de rutas por tipo pasa a ser `TIPO_ACTA` (`NoveltyType → tipo_acta`). `toActaPayload` no cambia: arma `datos` |
| `infrastructure/http-acta-mid.service.ts` | `POST {base}novedad/generaracta` con `{ tipo_acta, datos }`. La ruta vive aquí, que es quien arma URLs. Se conservan la verificación de `file_base64` y el timeout de 30 s |
| `shared/http/api-error.ts` | `describeApiError` lee `detail: [{campo, mensaje}]` y antepone el campo sin el prefijo `datos.` ("contrato.supervisor: es obligatorio"), porque muchos mensajes solo se entienden con él. El parser de Pydantic se retira con el FastAPI |

El puerto, su binding en `app.config.ts`, los casos de uso y la presentación no cambian.

### Base local hasta el despliegue

Mientras el endpoint no esté desplegado, la base es `ACTAS_MID_SERVICE = 'http://localhost:8081/v1/'`
en los tres ambientes, y `NOVEDADES_MID_SERVICE` **no se toca**: sigue apuntando al mid
desplegado, del que salen todas las demás escrituras. La base local termina en `/v1/` igual que
la del mid, así que la ruta relativa es la misma con las dos.

`ACTAS_MID_SERVICE` **no** entra a la allowlist del interceptor: el endpoint no valida token.

### Los tipos se garantizan en el origen

Como un decimal tumba el acta entera, los dos campos enteros que podían llegar con decimales
se corrigen donde nacen:

- Los días de prórroga (adición/prórroga) y los días de pago al cedente (cesión) exigen un entero
  en el formulario (`SOLO_ENTEROS`): son datos jurídicos que también se registran en la novedad,
  así que redondearlos en silencio cambiaría lo que el usuario aprobó.
- El tamaño de letra se redondea en el mapper: es un ajuste de impresión y el control de la vista
  admite decimales.

El resto (documentos, número de contrato, vigencia, unidad ejecutora, fechas) ya llegaba con el
tipo correcto desde los mappers de contrato.

## Consecuencias

- (+) Un generador menos que operar: el acta sale del mismo middleware que registra la novedad, y
  al desplegarse hereda su despliegue, su CI y su autenticación.
- (+) El cambio de generador confirmó el puerto de ADR-016: tres archivos de infraestructura y
  sus pruebas, sin tocar casos de uso ni pantallas.
- (+) Los rechazos del generador llegan al usuario con su campo y su motivo, en vez del genérico
  "El servicio rechazó los datos enviados.".
- (−) **El acta sigue apuntando a localhost en los tres ambientes**, y como desde
  [ADR-018](ADR-018-acta-antes-de-la-novedad.md) el acta bloquea la creación, en un ambiente real
  no se puede registrar ninguna novedad hasta que `generaracta` se despliegue. Al desplegarse, el
  cambio es de una línea: en `http-acta-mid.service.ts`, `environment.ACTAS_MID_SERVICE` →
  `environment.NOVEDADES_MID_SERVICE`, y borrar `ACTAS_MID_SERVICE` de los environments. El
  interceptor adjuntará entonces el token que exige el gateway.
- (−) Para probar en local, el mid tiene que correr con `BEEGO_RUNMODE=dev`: en modo producción su
  CORS solo acepta `*.udistrital.edu.co` y el navegador ve `status 0` (`SIN-CONEXION`).
- (−) Un nombre de campo mal escrito en el mapper no da error: el dato no llega y el acta imprime
  `________` (o la validación responde "es obligatorio"). Las pruebas de `acta-payload.mapper.spec.ts`
  fijan los nombres.
