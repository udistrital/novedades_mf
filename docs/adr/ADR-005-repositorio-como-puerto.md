# ADR-005 — `IContractRepository` como puerto (clase abstracta-token DI) + capa anticorrupción

**Fecha**: 2026-06-30 (dominio/mock) y 2026-07-06 (implementación HTTP real, commit `81dc395`) · **Estado**: Aceptada

## Contexto

Las APIs institucionales legadas tienen esquema laxo y no documentado campo a campo: nombres alternativos (`ValorContrato`/`Valor`), valores como string u objeto, `[{}]` para "sin filas", envoltorio `{Code, Body}` en el mid. Además el backend estuvo mockeado durante semanas de desarrollo de UI.

## Problema

Cómo desacoplar dominio y vistas de ese backend hostil, y cómo alternar mock ↔ real sin tocar consumidores.

## Alternativas consideradas

1. Servicios que llaman HTTP directo y devuelven la forma del backend (patrón `RequestManager` del proyecto guía, con `any`): acopla todo al esquema legado y captura el token una sola vez (defecto conocido de la guía).
2. Interface TypeScript + `InjectionToken` manual: funciona, pero exige mantener token e interface por separado.
3. **Clase abstracta usada como token de DI** + DTOs/mappers.

## Decisión

`IContractRepository` (clase abstracta en `domain/repositories/`) es a la vez contrato y token. El binding vive únicamente en `app.config.ts`. Implementaciones: `HttpContractService` (real) y, en su momento, `MockContractService` para desarrollo sin backend — **eliminado el 2026-07-23** por no tener uso; hoy el puerto tiene una sola implementación. Que siga siendo un puerto no es abstracción especulativa: `IActaGenerator`, el segundo puerto (ADR-016), existe justamente porque su implementación es temporal y va a cambiarse. Todo lo tolerante al esquema legado vive en `infrastructure/dtos/` + `infrastructure/mappers/` (capa anticorrupción): el dominio nunca ve un DTO.

## Consecuencias

- (+) Swap real/mock de una línea; dominio limpio; el cambio de esquema del backend toca solo DTO+mapper.
- (−) Toda operación nueva se implementa **dos veces** (real y mock) — obligación registrada en [AI_GUIDE.md](../AI_GUIDE.md).
- Convención para dominios futuros: mismo patrón, un puerto por agregado raíz.
