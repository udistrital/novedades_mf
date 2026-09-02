# ADR-011 — Migración por fases: lecturas reales primero, escrituras simuladas

**Fecha**: 2026-07-06 (commit `81dc395`, conexión de lecturas) · **Estado**: **Reemplazada por [ADR-014](ADR-014-escrituras-reales-sin-replica.md)** (2026-07-07, cierre de MIG-001)

## Contexto

La UI completa se construyó contra `MockContractService`. Al conectar el backend real se comprobó que las lecturas (contratos, proveedores, novedades) eran integrables de inmediato, mientras que las escrituras (crear/anular novedad) dependen de definir con backend el contrato del POST/PATCH del mid y el mecanismo de réplica hacia Ágora (deuda TD-007: el legado compensaba manualmente sin transacción real).

## Problema

Bloquear toda la integración hasta resolver las escrituras, o entregar valor por fases.

## Alternativas consideradas

1. Conectar todo o nada: retrasaría la validación de las lecturas y de la UI con datos reales.
2. **Fase 1 lecturas reales / escrituras simuladas explícitamente marcadas**.

## Decisión

`HttpContractService.createNovelty/annulNovelty` devuelven éxito simulado (`delay(400)`) con `console.warn` y comentarios `TODO(escrituras)` como marcadores. Los switches de prueba `forceError` en los modales permiten ejercitar los caminos de error de la UI mientras tanto.

## Consecuencias

- (+) Las lecturas y toda la UX quedaron validadas contra datos reales sin esperar al backend de escrituras.
- (−) **Riesgo mayor conocido**: el sistema "finge" registrar novedades — bloqueante absoluto de producción, registrado como riesgo #1 del [MIGRATION_PLAN](../../info/MIGRATION_PLAN.md#6-riesgos-para-salida-a-producción).
- Los `console.warn`/TODO no deben "limpiarse" sin conectar la escritura (regla en [AI_GUIDE.md](../AI_GUIDE.md)); al cerrar MIG-001 este ADR pasa a estado **Reemplazada**.
