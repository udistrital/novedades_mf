# ADR-001 — Reescritura completa en Angular 18 (no actualización de AngularJS)

**Fecha**: 2026-06-30 (inferida del historial: scaffold inicial) · **Estado**: Aceptada

## Contexto

El sistema origen (`novedades_cliente`) es AngularJS 1.7.9 con Grunt/Bower, ES5, sin bundler ni transpilador, dentro del cliente monolítico Argo. AngularJS está en fin de vida. El levantamiento de requerimientos, hecho leyendo el código del legado, concluye que no existe ruta de actualización incremental.

## Problema

¿Actualizar el stack existente, hibridar (ngUpgrade) o reescribir?

## Alternativas consideradas

1. **Upgrade incremental / ngUpgrade**: inviable — la brecha AngularJS→Angular moderno con ese tooling equivale a reescribir con un puente extra de complejidad.
2. **Reescritura en Angular 18**: versión estable soportada por `single-spa-angular` y coherente con la modernización institucional.
3. Otros frameworks: descartado — el ecosistema OAS (lineamientos, proyecto guía, root) es Angular.

## Decisión

Reescribir el módulo de novedades como aplicación Angular 18 nueva, migrando **comportamiento funcional** (no código) desde los requerimientos levantados del legado.

## Por qué Angular 18

Al iniciar el proyecto (junio de 2026), las dos fuentes documentadas para montar un MF Angular en single-spa llegaban hasta Angular 18:

- El sitio oficial de single-spa (`single-spa.js.org/docs/ecosystem-angular`) lista la compatibilidad hasta "Angular 18 is supported by single-spa-angular@9".
- El lineamiento institucional de single-spa (`lineamientos_oas`, `single_spa/parcel.md`) instala `single-spa-angular@9.0.1`.

Las líneas 20 y 21 de `single-spa-angular` acababan de publicarse en npm (abril de 2026, tras dos meses bajo el nombre provisional `@single-spa-community/angular`), sin documentación en el sitio, sin adopción en los lineamientos y sin ningún MF institucional que las usara. Angular 18 con `single-spa-angular` 9 era la combinación documentada y probada.

## Consecuencias

- (+) Stack soportado, TypeScript estricto, tooling moderno, base testeable.
- (−) La paridad funcional debe medirse y completarse explícitamente → se midió contra el levantamiento del legado, requerimiento por requerimiento.
- La compatibilidad con Angular 18 es una restricción del proyecto: no actualizar el framework sin decisión explícita.

## Estado del soporte (2026-10-19)

- **Ya hay soporte oficial para versiones superiores.** El paquete `single-spa-angular`, desde su repositorio oficial (`github.com/single-spa/single-spa-angular`), publica las líneas 20.x y 21.x (21.0.2, junio de 2026), con la versión mayor alineada a la de Angular y su tabla de compatibilidad en el README. `gestion_contractual_mf`, del mismo sistema y el mismo shell, ya corre Angular 21 con `single-spa-angular` 21. El sitio de single-spa y el lineamiento siguen documentando hasta la 9.x.
- **Angular 18 está fuera de soporte**: angular.dev da las versiones 2 a 19 como sin soporte; hoy lo tienen la 20, la 21 y la 22. Sus avisos de seguridad, y por qué ninguno es alcanzable en este MF, están en [SEGURIDAD.md](../SEGURIDAD.md#42-avisos-del-framework-y-por-qué-no-son-alcanzables).
- **La migración es progresiva y acotada**: una versión mayor por paso con `ng update` (18 → 19 → 20 → 21), como la hizo `gestion_contractual_mf` del 16 al 19 de septiembre de 2026. Este código ya está escrito en el estilo que esas versiones vuelven el predeterminado (componentes standalone, signals, zoneless, control flow `@if`/`@for`), así que el trabajo cae sobre todo en las dependencias (framework, Material, `@angular-builders/custom-webpack`, `angular-eslint`, `single-spa-angular` 21) y en las migraciones automáticas de `ng update`. Cambios de código ya identificados: `provideExperimentalZonelessChangeDetection` pasa a `provideZonelessChangeDetection` (`app.config.ts`) y `getSingleSpaExtraProviders` a `provideSingleSpaPlatform` (`main.single-spa.ts`). No cambia la arquitectura ni el comportamiento.
- **Queda como trabajo futuro.** Hacerla exige un ADR nuevo que reemplace la restricción de arriba.
