# ADR-008 — Clase base abstracta `CreateNoveltyPage` para las páginas de novedad

**Fecha**: 2026-06-30 (commit `52becff`) · **Estado**: Aceptada

## Contexto

Las 5 páginas de creación (adición/prórroga, suspensión, cesión, terminación, reinicio) comparten el mismo esqueleto: cargar el contrato de la ruta, breadcrumb, validar el formulario, modal de confirmación con resumen, envío y máquina de estados formulario→éxito/error.

## Problema

Cómo evitar quintuplicar esa mecánica sin acoplar las páginas entre sí.

## Alternativas consideradas

1. Duplicar el flujo en cada página: 5 copias del mismo ciclo de vida.
2. Componer con un componente contenedor + content projection: el contenedor necesitaría conocer el form y el draft de cada página — la API se vuelve más compleja que una base.
3. **Clase base abstracta `@Directive()`** con el flujo común y 4 puntos de extensión.

## Decisión

`CreateNoveltyPage` (`presentation/pages/create-novelty-page.base.ts`), abstracta y decorada con `@Directive()` para poder usar DI. Cada página define solo: `noveltyName`, `form`, `buildDraft()`, `buildSummary()`. La composición visual sí es por componentes (`novelty-page-layout` + átomos).

## Consecuencias

- (+) Una página de novedad nueva son ~100 líneas de lo específico; el flujo común se corrige en un solo lugar.
- (−) Herencia entre componentes es excepcional en Angular moderno: queda documentado que es deliberada y **no** un patrón general del proyecto (no crear más jerarquías de componentes sin ADR).
- La máquina de estados está diagramada en [ARCHITECTURE.md](../ARCHITECTURE.md#flujo-de-creación-de-una-novedad).
