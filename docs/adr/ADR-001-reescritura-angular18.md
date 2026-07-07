# ADR-001 — Reescritura completa en Angular 18 (no actualización de AngularJS)

**Fecha**: 2026-06-30 (inferida del historial: scaffold inicial) · **Estado**: Aceptada

## Contexto

El sistema origen (`novedades_cliente`) es AngularJS 1.7.9 con Grunt/Bower, ES5, sin bundler ni transpilador, dentro del cliente monolítico Argo. AngularJS está en fin de vida. El levantamiento de requerimientos (`referencias/requerimientos_novedades_original.md` §12.1) concluye que no existe ruta de actualización incremental.

## Problema

¿Actualizar el stack existente, hibridar (ngUpgrade) o reescribir?

## Alternativas consideradas

1. **Upgrade incremental / ngUpgrade**: inviable — la brecha AngularJS→Angular moderno con ese tooling equivale a reescribir con un puente extra de complejidad.
2. **Reescritura en Angular 18**: versión estable soportada por `single-spa-angular` y coherente con la modernización institucional.
3. Otros frameworks: descartado — el ecosistema OAS (lineamientos, proyecto guía, root) es Angular.

## Decisión

Reescribir el módulo de novedades como aplicación Angular 18 nueva, migrando **comportamiento funcional** (no código) desde los requerimientos levantados del legado.

## Consecuencias

- (+) Stack soportado, TypeScript estricto, tooling moderno, base testeable.
- (−) La paridad funcional debe medirse y completarse explícitamente → existe [`MIGRATION_PLAN.md`](../../MIGRATION_PLAN.md) con la brecha requerimiento a requerimiento.
- La compatibilidad con Angular 18 es una restricción del proyecto: no actualizar el framework sin decisión explícita.
