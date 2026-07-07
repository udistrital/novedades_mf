# ADR-003 — Standalone components + zoneless + signals

**Fecha**: 2026-06-30 (scaffold inicial: `app.config.ts` con `provideExperimentalZonelessChangeDetection`) · **Estado**: Aceptada

## Contexto

El proyecto guía institucional (`solicitudes_sabaticos_mf`) usa NgModules + `platformBrowserDynamic` + zone.js, herencia de su propia migración. Angular 18 ofrece standalone components, APIs de señales (`input()/output()/model()`), control flow nuevo y change detection zoneless experimental.

## Problema

¿Seguir el estilo del proyecto guía (NgModules/zone) o adoptar las APIs modernas de Angular 18?

## Alternativas consideradas

1. **NgModules + zone.js** (paridad con la guía): compatible pero arrastra boilerplate y doble mecanismo de reactividad.
2. **Standalone + zoneless + signals**: menos código, reactividad explícita, compatible con single-spa-angular (verificado: el auditoría de lineamientos lo clasificó como equivalencia válida — `referencias/COMPLIANCE_REPORT.md` §4).

## Decisión

Todo el MF es standalone; el estado reactivo son signals; la app corre zoneless. RxJS queda reservado para I/O (HTTP, `valueChanges`). El root sigue proveyendo zone.js para otros MFs — este simplemente no lo usa.

## Consecuencias

- (+) Sin NgModules ni suscripciones de estado; templates 100 % control flow nuevo.
- (−) Divergencia estilística con el proyecto guía (aceptada y documentada como equivalencia); los desarrolladores que vengan de la guía deben leer [CODING_STANDARDS.md](../CODING_STANDARDS.md).
- Regla derivada: nunca depender de zone (no `detectChanges()` como parche; si la vista no reacciona, el estado no era un signal).
