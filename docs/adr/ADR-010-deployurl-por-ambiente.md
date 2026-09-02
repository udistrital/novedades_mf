# ADR-010 — `deployUrl` por ambiente con la URL pública real

**Fecha**: 2026-07-07 (migración H1 del compliance) · **Estado**: Aceptada

## Contexto

En single-spa el root importa `main.js` del MF desde una URL absoluta; los chunks lazy y assets deben resolverse contra la URL pública donde el MF está desplegado, no contra el origen del shell. El proyecto tenía `deployUrl: http://localhost:4209/` en las opciones comunes de `angular.json`, de modo que el build de producción emitía chunks apuntando a localhost.

## Problema

Cómo garantizar que las 6 rutas lazy carguen en cada ambiente desplegado.

## Alternativas consideradas

1. `set-public-path.ts` en runtime (patrón single-spa genérico, derivando el path de la URL del script): funciona en cualquier host, pero no es el patrón institucional.
2. **`deployUrl` por configuración** con la URL pública real de cada ambiente — patrón confirmado en el proyecto guía (`solicitudes_sabaticos_mf/angular.json`).

## Decisión

Opción 2: `production` → `https://novedades.portaloas.udistrital.edu.co/`, `test` → `https://pruebasnovedades.portaloas.udistrital.edu.co/`, `development` → `http://localhost:4209/`. Dominios verificados contra los environments del cliente legado (`referencias/environment_prod.js`, `environment_test.js`).

## Consecuencias

- (+) Paridad con el estándar OAS; chunks correctos por ambiente (verificado en el bundle).
- (−) Un dominio de despliegue nuevo exige tocar `angular.json`; si el hosting cambiara con frecuencia, reconsiderar la alternativa 1 con un ADR nuevo.
