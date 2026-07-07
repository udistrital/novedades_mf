# ADR-004 — Arquitectura DDD por capas con dominio único `contratos`

**Fecha**: 2026-06-30 (commits `febbf58`…`52becff`: una capa por commit) · **Estado**: Aceptada

## Contexto

El legado organizaba el código por pantallas/controladores con lógica de negocio mezclada en ellos. La reescritura busca que las reglas jurídicas (fechas, topes, estados) sean testeables y sobrevivan a cambios de UI o de backend.

## Problema

Cómo organizar el código para separar negocio, orquestación, detalle técnico y vista, sin sobre-ingeniería para un equipo pequeño.

## Alternativas consideradas

1. Estructura plana Angular clásica (`components/` + `services/`, como el proyecto guía): rápida, pero repite el defecto del legado (negocio dentro de componentes).
2. **DDD por capas dentro de una carpeta de dominio**: `domain/` puro, `application/`, `infrastructure/`, `presentation/`.
3. DDD táctico completo (aggregates, value objects, eventos de dominio): sobre-ingeniería para el alcance actual.

## Decisión

Opción 2, con un **único dominio** `src/app/domains/contratos/`. Dominios futuros = carpetas hermanas replicando las 4 capas. Regla de dependencia documentada en [ARCHITECTURE.md](../ARCHITECTURE.md#capas-ddd). `shared/` queda fuera de las capas (átomos UI, utilidades, http transversal) y no contiene negocio.

## Consecuencias

- (+) Reglas de negocio como funciones puras (`contract.rules.ts`) testeables sin Angular; backend intercambiable ([ADR-005](ADR-005-repositorio-como-puerto.md)).
- (−) Más carpetas que la estructura plana; los lineamientos OAS no exigen estructura interna, así que esta decisión es propia del proyecto y debe defenderse en revisiones.
- No introducir conceptos DDD adicionales (aggregates, eventos) sin necesidad demostrada.
