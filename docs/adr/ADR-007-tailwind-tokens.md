# ADR-007 — Tailwind con design tokens propios; Material puntual; Preflight desactivado

**Fecha**: 2026-06-30 (commit `dd65c55`, UI compartida) · **Estado**: Aceptada · **Completada por [ADR-017](ADR-017-css-acotado-al-host.md)**, que hace cumplir por construcción la regla de acotar todo al host — aquí solo se aplicó al Preflight, y el tema precompilado de Material la violaba.

## Contexto

La UI del MF fue rediseñada (diseño "Stitch") con una paleta granate/dorada y escalas tipográficas/espaciado propias, definidas como tokens en `tailwind.config.js`. El MF comparte el DOM con el shell y otros MFs, sin shadow DOM. El proyecto guía usa SCSS por componente + theme Material completo; los lineamientos (`core.md`) describen theming de Material con variables del root.

## Problema

Cómo estilar el MF con identidad propia sin contaminar al shell, y qué papel juega Angular Material.

## Alternativas consideradas

1. Angular Material como sistema de diseño completo + theme institucional: el diseño Stitch no es Material; forzarlo duplicaría overrides.
2. SCSS por componente (estilo guía): sin sistema de tokens, propenso a divergencia.
3. **Tailwind con tokens semánticos + Material solo donde aporta comportamiento** (iconos, autocomplete con teclado/a11y).

## Decisión

Opción 3. Además: **Preflight de Tailwind desactivado** — su reset global sin ámbito (`h1`, `table`, `*`) se filtraba al shell y rompía elementos del root; el reemplazo equivalente vive en `styles.scss` **acotado al host `novedades-mf`**. Átomos reutilizables (`card`, `form-field`, `modal-shell`, `feedback-card`…) en `shared/ui/` en lugar de repetir composiciones de utilidades.

## Consecuencias

- (+) Aislamiento real de estilos frente al shell; un solo vocabulario visual (tokens); átomos con API de signals.
- (−) El theme Material sigue siendo la paleta `azure-blue` (no institucional): brecha registrada y excluida por decisión del equipo (H3 del [COMPLIANCE_REPORT](../../info/referencias/COMPLIANCE_REPORT.md)). Desde ADR-017 ya no se importa el archivo precompilado, sino los mixins de esa misma paleta acotados al host.
- Reglas permanentes: no reactivar Preflight; ningún selector global sin anclar a `novedades-mf`; no introducir componentes Material de superficie ([CODING_STANDARDS.md](../CODING_STANDARDS.md#angular-material)).
