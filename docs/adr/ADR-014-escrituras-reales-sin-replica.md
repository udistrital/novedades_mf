# ADR-014 — Escrituras reales contra novedades_mid, sin réplica ni compensación en el cliente

**Fecha**: 2026-07-07 · **Estado**: Aceptada (reemplaza a [ADR-011](ADR-011-escrituras-simuladas.md))

## Contexto

El cliente legado orquestaba **todo** el flujo de guardado de cada novedad: `POST validarCambioEstado` → `POST novedad` → `POST replica` (escritura en Ágora/Titan) → `POST contrato_estado`, con compensación manual si la réplica fallaba (`PUT novedades_poscontractuales/{id}` con `Activo:false`). El inventario de endpoints marca ese patrón como "candidato a resolverse con una transacción/saga en la nueva arquitectura" (deuda TD-007), y el MIGRATION_PLAN (MIG-001) prohíbe reimplementar la compensación en el cliente sin confirmación de backend.

Además, los **nombres de campo exactos** del `POST novedad/` por tipo (`NP_SUS`…`NP_ADPRO`) no están documentados: viven en las funciones `Construir*` de `models/*.go` del repo backend `novedades_mid` (gap #1 de `info/backend/API_ENDPOINTS_mid.md`).

## Problema

Conectar las escrituras con fidelidad al flujo del legado sin heredar su anti-patrón de compensación manual, y sin el contrato de payload completo.

## Alternativas consideradas

1. Replicar la coreografía completa del legado (incluida réplica + compensación): reimplementa en el cliente la transaccionalidad que TD-007 exige mover al backend.
2. Una única llamada `POST novedad/` y nada más: los estados del contrato jamás cambiarían (el mid actual NO orquesta el cambio de estado).
3. **Cascada mínima documentada, sin réplica**: validar transición → crear novedad → registrar estado, dejando réplica/compensación al backend.

## Decisión

`HttpContractService.createNovelty` ejecuta: (1) `POST {mid}validarCambioEstado/` solo para las novedades que cambian el estado (Suspensión→2, Reinicio→4, Terminación→8); (2) `POST {mid}novedad/` con el payload de `novelty-payload.mapper.ts` (discriminador `tiponovedad` NP_*; Adición y Prórroga viaja como NP_ADPRO — ambas secciones son obligatorias por requerimiento actualizado, aunque el mapper conserva NP_ADI/NP_PRO por si vuelve el modo separado); (3) `POST {amazon}contrato_estado` con el estado destino. La anulación es `PATCH {mid}novedad/{id}` con `{usuario:"CC"+documento}` — el propio mid revierte el estado en cascada (`AnularNovedadYRevertirEstado`). "Activar contrato" reutiliza los pasos (1) y (3) con estado 4.

El envoltorio `Alert {Type, Code, Body}` se valida explícitamente (`esAlertaExitosa`): el mid responde HTTP 200 con `Type:"ERROR"` en fallos de negocio.

## Consecuencias

- (+) Los `console.warn`/`TODO(escrituras)` desaparecen; los caminos de éxito/error de la UI operan contra respuestas reales. ADR-011 pasa a **Reemplazada**.
- (−) **Payload por tipo es aproximación documentada**: si el backend rechaza el body, el único archivo a corregir es `novelty-payload.mapper.ts` (regla registrada ahí y en AI_GUIDE).
- (−) Sin réplica hacia Ágora/Titan ni compensación: hasta que backend resuelva TD-007, una novedad creada aquí **no** se replica en Titan/preliquidación. Riesgo documentado y aceptado por fase.
- (−) Si el paso (3) falla después de crear la novedad, el estado del contrato queda sin avanzar (misma ventana que tenía el legado); no se compensa en cliente por decisión del plan.
- Los switches de prueba `forceError` de los modales **se conservan**: siguen siendo la única forma de ejercitar los caminos de error de la UI sin depender del backend (retiro fácil documentado en el propio código).
