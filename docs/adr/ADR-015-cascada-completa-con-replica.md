# ADR-015 — Cascada completa de escritura, con réplica y compensación, contra los endpoints verificados

**Fecha**: 2026-08-01 · **Estado**: Aceptada (reemplaza a [ADR-014](ADR-014-escrituras-reales-sin-replica.md))

## Contexto

[ADR-014](ADR-014-escrituras-reales-sin-replica.md) decidió una cascada mínima (validar transición → crear novedad → registrar estado) **sin** réplica hacia Ágora/Titan ni compensación, porque (a) TD-007 pedía mover esa transaccionalidad al backend y (b) los nombres de campo del `POST novedad/` por tipo no estaban documentados.

Ese segundo punto dejó de ser cierto. El equipo capturó las **trazas de red reales** del cliente legado ejecutando cada novedad sobre el contrato de referencia **653/2025** en el ambiente de pruebas, y las registró en [`endpoints_registrados.md`](../endpoints_registrados.md): secuencia exacta de llamadas y payload literal de cada una, para Terminación Anticipada, Adición/Prórroga, Suspensión y Cesión (Reinicio se sumó el 2026-08-03).

Las trazas cambian tres supuestos de ADR-014:

1. **La réplica no es opcional.** El legado la llama siempre, y la traza de Cesión muestra su fallo seguido del `GET`+`PUT` de compensación sobre `novedades_poscontractuales` (`Activo:false`, `Motivo:"Error en la réplica"`). Sin ese par, una réplica fallida deja la novedad activa pero no replicada — el peor estado posible.
2. **`validarCambioEstado` es de doble modo.** Según `API_ENDPOINTS_mid.md`, con cuerpo en **arreglo** (`models.EstadoContrato[]`) solo *valida*; con cuerpo en **objeto** (`models.CambioEstado`) *valida y aplica*, llamando `contrato_estado` por dentro. ADR-014 usaba el modo objeto, lo que hacía redundante —y potencialmente duplicado— el paso (3).
3. **Cada novedad sube su acta primero.** El `POST gestor_documental` precede a la creación y devuelve el UUID que la novedad guarda en `enlace`.

## Problema

Alinear las escrituras con el comportamiento realmente observado del legado, sin escribir contra endpoints cuyo ambiente no esté verificado.

## Decisión

`HttpContractService` ejecuta la cascada completa, en el orden de las trazas:

```
[GET  tipo_novedad por nombre]            → Id del catálogo (lo exige la compensación)
[GET  estado_contrato por id]             → registro del estado destino
[GET  contrato_estado último]             → estado vigente del contrato
[GET  informacion_proveedor]              → cesionario (solo cesión)
 POST gestor_documental                   → enlace (UUID del acta)
[POST validarCambioEstado]  modo ARREGLO  → solo valida la transición
 POST novedad                             → crea la novedad
 POST replica  (PUT replica/{id} en Reinicio)
                                          → si falla ⇒ GET+PUT novedades_poscontractuales (Activo:false)
[POST contrato_estado]                    → aplica el nuevo estado
```

Los pasos entre corchetes solo corren cuando aplican: los de estado, para Suspensión (→2), Terminación Anticipada (→8) y Reinicio (→4); el del cesionario, solo para Cesión. **Adición/Prórroga y Cesión no cambian el estado del contrato** — las trazas no registran esas llamadas para ellas.

Las constantes por tipo (código `NP_*`, nombre de catálogo, `estado`, prefijo del acta, `TipoNovedad` de la réplica en la serie 216-220, estado destino) viven en una sola tabla, `NOVEDAD_BACKEND`, en `novelty-payload.mapper.ts`.

**Regla de seguridad sobre escrituras**: solo se ejecutan `POST`/`PUT`/`DELETE` contra endpoints **verificados contra el ambiente de pruebas**. Cualquier otra escritura queda **comentada** en el código con la razón. Hoy eso deja fuera `PUT {crud}poliza/{id}` (registro de póliza).

"Verificado" admite dos vías, y la diferencia importa:

1. **Traza capturada** del cliente legado en `endpoints_registrados.md` — URL y cuerpo literal. Es la vía fuerte: fija el payload campo por campo y por eso las pruebas unitarias pueden compararlo. Así están las siete escrituras de la cascada de creación.
2. **Ejecución funcional exitosa** contra el ambiente de pruebas, sin traza guardada. Vía débil: confirma que el endpoint responde y que el efecto ocurre, pero **no** confirma la forma de la respuesta ni el comportamiento en fallo.

**Excepción vigente (registrada el 2026-08-23)**: `PATCH {mid}novedad/{id}` (anular novedad) es la única escritura activa que entra por la vía 2. Se acepta porque su cuerpo es trivial (`{usuario}`, nada que adivinar), la cascada de reversión la ejecuta el backend (`AnularNovedadYRevertirEstado`) y el flujo está probado en funcionamiento. Queda pendiente su traza (**P0-6** del [plan de trabajo](../PLAN_TRABAJO.md)).

Consecuencia de esa excepción, corregida el mismo día: la respuesta del PATCH se validaba con `Success !== false`, asumiendo la forma de `utils_oas`. Si el endpoint responde con el envoltorio `Alert` del resto del mid, `Success` llega `undefined` y **una anulación rechazada se reportaba como exitosa** — el mismo fallo silencioso que hoy tiene el registro de póliza. Ahora `anulacionRechazada` (con prueba unitaria) comprueba las dos formas y basta que una niegue; una respuesta con forma desconocida se sigue aceptando, para no romper el camino feliz ya probado. La traza de P0-6 permitirá reducir esa función a la forma real.

## Consecuencias

- (+) Los payloads de los cinco tipos dejan de ser aproximación: son los de las trazas reales, fijados por pruebas unitarias que comparan campo por campo.
- (+) Una réplica fallida ya no deja datos a medias: la novedad se desactiva y el error se propaga a la UI.
- (+) `validarCambioEstado` y `contrato_estado` dejan de solaparse; el estado se aplica exactamente una vez.
- (−) La compensación transaccional vuelve al cliente, en contra de la intención de **TD-007**. Se acepta como fidelidad al legado mientras el backend no ofrezca una saga; el punto único a borrar el día que exista es `replicarOCompensar`.
  - Estuvo **deshabilitada entre el 2026-08-02 y el 2026-08-03** (no se conocía el propósito de ese `GET`+`PUT`). La traza de Reinicio lo confirmó como el mismo par de compensación de la traza de Cesión, así que quedó reactivada para los cinco tipos. Detalle: `TipoNovedad` viaja **plano** en el PUT aunque el GET lo devuelva anidado.
  - **La compensación desactiva, no borra**, pero **no hace falta filtrar en el cliente** (verificado el 2026-08-24): `GET /v1/novedad/:id/:vigencia` del mid consulta el CRUD con `activo:true` (ver `info/backend/API_ENDPOINTS_mid.md`), así que una novedad compensada no vuelve en el listado. Un filtro en `toNoveltySummaries` sería inalcanzable.
  - **La compensación puede no ocurrir, y eso ya no pasa en silencio** (2026-08-24). Se salta si no se pudo extraer el id de la novedad de la respuesta del POST, y falla en silencio si el `GET`+`PUT` no responde. En ambos casos la novedad queda **activa y sin replicar** —el estado que este ADR dice que no debe existir— y antes el usuario veía el mismo mensaje que en el caso bueno, donde no queda nada registrado. Ahora `compensarNovedad` devuelve si logró desactivarla y `errorDeReplica` (función pura, con pruebas) añade una advertencia explícita cuando no. Es detección, no solución: la solución sigue siendo TD-007 del lado del backend.
- **Reinicio queda integrado a la cascada (2026-08-03)** con su propia traza, y aporta la única excepción del flujo: su réplica es un **`PUT {mid}replica/{id}`**, no un `POST`. No crea un registro en Ágora/Titan — **actualiza la suspensión que reanuda**, cerrándola con la fecha de reinicio; de ahí que lleve `TipoNovedad: 216` (el de suspensión) y solo seis campos. El cliente legado nunca resolvía ese id (pedía `.../replica/undefined`), por lo que su reinicio fallaba siempre y terminaba compensando. Aquí el id es el de la novedad de suspensión vigente y la cascada se corta antes de llamar si no existe: **pendiente de confirmar** con una traza exitosa.
- **`periodosuspension` no se cuenta con el calendario**: es mes = 30 días con ambos extremos incluidos (`suspensionDays`). Las dos trazas lo fijan (26 y 49; el calendario daba 23 y 46) y solo con ese conteo cuadra la `fechafinefectiva` de la traza de Suspensión. No contradice [ADR-013](ADR-013-normalizacion-fechas-legado.md): esto es la regla contable de negocio ya vigente (mes = 30 días), no un parche de `Date`.
- Diferencias por tipo verificadas contra las trazas y fijadas por pruebas: la réplica de **Terminación Anticipada es la única que NO envía `UnidadEjecucion`**; la de **Cesión envía `PlazoEjecucion: 1` fijo** (no los "días faltantes por pago" del formulario, que son un dato de plata); `numerocdp` viaja como **string** aunque su input sea `type="number"`.
- (−) `updatePoliza` queda inerte: la página de registro de póliza reportará éxito sin escribir. Debe reactivarse en cuanto se verifique ese endpoint.
- (−) `fechafinefectiva` se deriva del plazo vigente del dominio y de las fechas de la propia novedad, no de `acta_inicio` (la fuente real, aún sin conectar). Es una aproximación acordada: si el backend la rechaza, conectar `acta_inicio` y calcular sobre su fecha fin.
- Las fechas viajan como **mediodía de Bogotá** (`…T17:00:00.000Z`), igual que el legado: enviar medianoche UTC correría el día hacia atrás al leerse en UTC-5. Es formato de cable; [ADR-013](ADR-013-normalizacion-fechas-legado.md) sigue vigente para la aritmética de dominio.
