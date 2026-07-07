# ADR-006 — Estado de UI con signals en servicios de aplicación (sin NgRx)

**Fecha**: 2026-06-30 (commit `e760403`) · **Estado**: Aceptada

## Contexto

La app es zoneless ([ADR-003](ADR-003-standalone-zoneless-signals.md)): la vista reacciona a signals. El estado compartido entre vistas es pequeño (resultados de búsqueda, contrato seleccionado, flags de carga/error).

## Problema

Dónde y cómo mantener el estado que comparten dashboard y páginas de novedad.

## Alternativas consideradas

1. **NgRx / store global**: infraestructura y ceremonia desproporcionadas para ~2 slices de estado.
2. `BehaviorSubject` en servicios (patrón del proyecto guía): doble mecanismo de reactividad con zoneless, suscripciones manuales.
3. **Signals en servicios de aplicación**: `signal` privado + `computed` públicos + métodos-acción.

## Decisión

Opción 3, ejemplar canónico `ContractStateService`: el signal de estado es privado; los componentes leen selectores `computed` y disparan acciones (`loadContracts`, `loadContract`). RxJS solo como transporte (HTTP/`valueChanges`), convertido en el borde (`subscribe` dentro del servicio, `toSignal` en formularios).

## Consecuencias

- (+) Unidireccional, sin gestión de suscripciones de estado, legible para revisores sin experiencia NgRx.
- (−) Sin devtools de time-travel ni efectos declarativos; si el estado creciera en complejidad (múltiples dominios interdependientes), reevaluar con un ADR nuevo.
- Anti-patrón derivado prohibido: `BehaviorSubject` como store de vista ([CODING_STANDARDS.md](../CODING_STANDARDS.md#anti-patrones-rechazo-directo-en-revisión)).
