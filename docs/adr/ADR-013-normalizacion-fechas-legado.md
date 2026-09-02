# ADR-013 — No replicar la normalización de fechas del legado (mediodía / día 31)

**Fecha**: 2026-07-07 · **Estado**: Aceptada (cierra la decisión pendiente MIG-013)

## Contexto

El cliente legado normalizaba todas las fechas a mediodía y corregía automáticamente el día 31 (lo pasaba al día 1 del mes siguiente). El levantamiento de requerimientos (§5.2/§5.9) las registra como reglas recurrentes, pero su análisis concluyó que son **mitigaciones técnicas de bugs de `Date` en JavaScript** (desfases por zona horaria/DST al operar con medianoche), no reglas de negocio.

## Problema

Decidir si el MF replica esas correcciones literalmente o solo preserva su resultado visible (plazos y fechas correctos).

## Alternativas consideradas

1. Replicar literalmente (mediodía + salto del día 31): arrastra al código nuevo la cicatriz de un bug que este stack no tiene.
2. **Preservar solo el resultado**: la aritmética de fechas del MF opera con strings `yyyy-mm-dd`/`dd/mm/yyyy` parseados a `Date` **local** (`format.util.ts#parseAnyDate`), donde el desfase de medianoche/UTC no aplica.

## Decisión

No se replica ninguna de las dos correcciones. La aritmética existente (`addDaysToDate`, `daysBetween`, `addDaysToTerm`) es la fuente única de cálculo y sus casos borde quedan cubiertos por pruebas unitarias (`format.util.spec.ts`): 31 de enero + 1 día y + 30 días (cruzando febrero bisiesto), resta de días sobre el 1 de marzo, y diferencias a través del 29 de febrero.

## Consecuencias

- (+) Código sin hacks heredados; el caso "31 + 1 mes" queda gobernado por la regla mes = 30 días ([ADR-012](ADR-012-regla-mes-30-dias.md)), no por un salto artificial de fecha.
- (−) Si negocio demostrara que el salto del día 31 era una regla contable real (no un bug), habría que introducirla en `format.util.ts` — las pruebas existentes delimitarían el cambio.
