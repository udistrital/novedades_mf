# ADR-012 — Preservar la regla "mes = 30 días" del legado

**Fecha**: 2026-06-30 (implementación en `format.util.ts`) · **Estado**: Aceptada (condicionada a validación de negocio — TD-010)

## Contexto

Todo el cálculo de plazos del sistema legado usa aritmética de meses fijos de 30 días (convertir "NUEVE ( 9 ) MESES" a 270 días, sumar días de prórroga, reexpresar en "MESES Y DÍAS"). El levantamiento de requerimientos (§5.9, §12.11) marca explícitamente que debe **decidirse** si se preserva o se corrige a calendario real, y esa decisión pertenece a jurídica/negocio, no al equipo técnico.

## Problema

Qué aritmética de plazos implementar mientras el negocio no se pronuncia.

## Alternativas consideradas

1. Calendario real: "más correcto", pero produciría plazos distintos a los de todas las actas históricas y al sistema aún en producción — divergencia funcional silenciosa.
2. **Fidelidad al legado (30 días/mes)** hasta pronunciamiento formal.

## Decisión

Opción 2: `DIAS_POR_MES = 30` en `shared/util/format.util.ts` (`addDaysToTerm`), documentada como regla contable del negocio. La eventual corrección es la deuda TD-010 del [MIGRATION_PLAN](../../MIGRATION_PLAN.md#4-deuda-técnica-no-implementar-en-esta-migración).

## Consecuencias

- (+) Paridad de resultados con el sistema en producción; sin sorpresas en actas.
- (−) Diferencias de días acumuladas frente al calendario real en plazos largos.
- Si negocio decide cambiarla, el punto único de cambio es `format.util.ts` y este ADR se reemplaza.
