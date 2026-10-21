# ADR-002 — Integración como parcel single-spa bajo `/novedades`

**Fecha**: 2026-06-30 (commit `ebb5fc8`) · **Estado**: Aceptada

## Contexto

La nueva plataforma de gestión contractual es una composición de microfrontends: root `gestion_contractual_root_mf` (orquestador) + `core_mf_cliente` (layout/auth/menú) + MFs por dominio. Los lineamientos OAS (`single_spa/*.md`) prescriben single-spa con `create-single-spa` y `single-spa-angular`.

## Problema

Cómo empaquetar y montar la app Angular para que el root la cargue, sin colisionar con el shell ni con otros MFs.

## Alternativas consideradas

1. **Parcel single-spa-angular (UMD)** — patrón institucional (lineamientos + proyecto guía).
2. Module Federation / iframes — fuera del estándar OAS; descartado.

## Decisión

Empaquetar como UMD `novedades-mf` vía `@angular-builders/custom-webpack` + `single-spa-angular/lib/webpack`. `main.single-spa.ts` es el único entry point: exporta `bootstrap/mount/unmount` y auto-arranca en standalone cuando `<novedades-mf>` existe en el DOM (solo en el `index.html` propio). `APP_BASE_HREF='/novedades'` en el bootstrap single-spa. zone.js NO se empaqueta (`polyfills: []`): el root lo provee por CDN (lineamiento `root_config.md`).

## Consecuencias

- (+) Cumple el estándar institucional; desarrollo standalone y montado comparten un solo entry.
- (−) Restricciones permanentes: sin estilos globales sin ámbito (ver [ADR-007](ADR-007-tailwind-tokens.md)), sin `mat-typography` en el template raíz, chunks resueltos por `deployUrl` ([ADR-010](ADR-010-deployurl-por-ambiente.md)).
- El subject de props del scaffold (`single-spa-props`) se eliminó por no tener consumidores (2026-07-06); re-crear solo ante necesidad real.
