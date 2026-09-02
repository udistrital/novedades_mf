# ADR-016 — Generación de actas detrás de un puerto, fuera de la transacción de la novedad

**Fecha**: 2026-08-03 · **Estado**: Aceptada

## Contexto

Hasta ahora el PDF del acta no existía: los payloads viajaban con `file: ''` y
`document-preview-control.component.ts` no disparaba nada
([ADR-015](ADR-015-cascada-completa-con-replica.md)).

Ya hay un servicio que lo genera: **`actas_novedad_mid`**, un middleware sin estado
(FastAPI) con un endpoint por tipo de acta. Recibe **todos** los datos en el POST —no
consulta ÁGORA, no persiste nada, no valida token— y devuelve el PDF en base64 dentro de
un JSON (`docs_integracion_agente_actas_mid.md`).

Dos condiciones explícitas del equipo:

1. **El PDF no se envía al backend todavía.** Solo se genera y se descarga para el usuario;
   el gestor documental sigue recibiendo `file: ''`.
2. **El servicio es temporal** y va a reemplazarse por otro generador.

## Decisión

### Puerto en el dominio, implementación en infraestructura

`IActaGenerator` (`domain/repositories/acta-generator.repository.ts`) declara una sola
operación: `generarActa(contract, draft) → NoveltyDocument`. Es el mismo patrón que
`IContractRepository` (clase abstracta como token de DI, [ADR-005](ADR-005-repositorio-como-puerto.md)).

Solo **dos archivos** conocen el contrato del middleware:

| Archivo | Qué contiene |
|---|---|
| `infrastructure/http-acta-mid.service.ts` | URL base, forma de la respuesta, timeout |
| `infrastructure/mappers/acta-payload.mapper.ts` | rutas por tipo y payload de cada acta |

Reemplazarlo = escribir otra implementación del puerto y cambiar una línea en
`app.config.ts`. No se toca ningún formulario, caso de uso ni regla de dominio. La URL vive
en `environment.ACTAS_MID_SERVICE`.

La abstracción con una sola implementación es deliberada y no especulativa: el reemplazo es
un hecho anunciado, no una posibilidad.

### ~~El acta corre después de la novedad y no puede tumbarla~~ — REEMPLAZADA

> **Superada por [ADR-018](ADR-018-acta-antes-de-la-novedad.md) (2026-08-24)**: el acta pasó a
> generarse **antes** de la cascada, y su fallo **sí** aborta el trámite. El resto de este ADR
> —el puerto `IActaGenerator`, el mapeo de payloads y el carácter temporal del middleware—
> sigue vigente. Se conserva el texto original abajo como registro de la decisión anterior.

`CreateNoveltyPage.onConfirm` encadenaba la generación al éxito de la creación:

```
crear novedad (cascada completa, atómica)  →  generar acta  →  descargar
```

`ActaGeneratorService.generarYDescargar` **nunca fallaba**: capturaba el error, lo dejaba en un
signal y completaba. Razón: el PDF no forma parte de la transacción (no se envía al backend),
así que un fallo suyo no podía convertir una novedad ya registrada en un error.

Consecuencia a cubrir: si el acta fallaba, el usuario se quedaba sin el documento y **no podía
volver a crear la novedad** (ya existía). La pantalla de éxito mostraba el motivo real y un
botón **"Volver a generar el acta"** que reintentaba solo ese paso.

### Datos que el acta obliga a resolver

El bloque `contrato` del servicio exige datos que el dominio no guardaba. Se agregaron
tres campos a `Contract`, todos leídos de fuentes que ya se consultaban:

| Campo | Origen | Por qué |
|---|---|---|
| `subscriptionDate` | `ContratoSuscrito.FechaSuscripcion` | La firma es anterior al inicio; el acta imprime ambas |
| `executingUnit` | `contrato_general.UnidadEjecutora` | 1 = Oficina de Contratación, otro = Ofex: define quién firma |
| `spendingManagerDocument` | `ordenadores.Documento` | `Persona.documento` es obligatorio |

Y `CesionDraft.cesionario` conserva el `Assignee` ya elegido en el autocomplete: el backend
solo necesita la cédula, pero el acta imprime el nombre, y volver a consultarlo sería pedir
dos veces lo que ya está en pantalla.

**`valor_contrato` y `plazo_dias` se envían vigentes** (con adiciones y prórrogas ya
registradas), no iniciales: el servicio valida contra ellos el tope del 50 % de la adición y
el balance de la liquidación, que son los mismos topes que aplican los formularios. Enviar
el valor inicial haría que el servicio rechazara adiciones que el formulario sí acepta.

**Los tres saldos de la terminación se envían tal como los digitó el usuario**, aunque el
servicio pueda calcular el de la universidad. Un acta es un documento legal: no debe
imprimir cifras que el usuario no aprobó. Si no cuadran contra el valor vigente, el 422 con
`"el balance no cuadra"` es el dato útil, no un estorbo.

## Consecuencias

- (+) El acta existe y llega al usuario, sin tocar la transacción de la novedad.
- (+) El reemplazo del servicio queda acotado a dos archivos y un binding.
- (+) `describeApiError` ahora entiende el `detail: [{loc, msg}]` de FastAPI (sin su prefijo
  interno `"Value error, "`), así que los 422 del acta llegan al usuario como frases reales.
- (−) El PDF **no** queda archivado: si el usuario pierde el archivo descargado, no hay
  dónde recuperarlo hasta que se decida subirlo al gestor documental.
- (−) ~~`rol` y `resolucion` de las personas no se envían~~ — **corregido el 2026-08-24**: la
  premisa era falsa, el backend sí expone ambos y no se estaban leyendo. Con `rol`
  (`ordenadores.RolOrdenador`, `contrato_general.Supervisor.Cargo`) y `resolucion`
  (`ordenadores.InfoResolucion`) se llenan cuatro huecos que salían como `________`: "quien
  actúa en calidad de …", "según …", "el … solicitó la adición" y el cargo bajo la firma.
- (+) **Cuadro de firmas y tamaño de letra** (2026-08-24): `elaboro` sale del usuario en sesión
  (`informacion_persona_natural` por el documento del JWT, que solo trae la cédula) y
  `jefe_juridica_nombre` del jefe de la Oficina de Contratación
  (`supervisor_contrato?query=DependenciaSupervisor:DEP636`, el más reciente por `FechaFin`).
  Ambos se resuelven **una vez por sesión** —no dependen del contrato ni de la novedad— y su
  consulta **nunca falla**: son campos opcionales, y no poder resolver un nombre no puede
  impedir generar el acta y con ella registrar la novedad. Se normalizan a nombre propio
  (`aNombrePropio`) porque el backend los devuelve en mayúsculas y el formato institucional los
  escribe "Laura Niño"; el resto de nombres del acta se dejan como los entrega Ágora.
  `tamano_letra` (1-50, 10 por defecto) viaja desde el control que ya existía en la vista y que
  hasta entonces no llegaba a ninguna parte.
- (−) Los considerandos condicionales de cesión previa (`cesion_previa`, `adicion_previa`,
  `reinicio_previo`) no se envían: exigirían resolver el nombre del contratista anterior.
  El acta simplemente no los imprime.
- (−) `environment.ACTAS_MID_SERVICE` apunta a `http://localhost:8080/` en los **tres**
  ambientes porque el servicio no tiene despliegue institucional. Es exactamente el riesgo
  que señala [ADR-010](ADR-010-deployurl-por-ambiente.md): corregir la URL de test y
  producción en cuanto exista.
