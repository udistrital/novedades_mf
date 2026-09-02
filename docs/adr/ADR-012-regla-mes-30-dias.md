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

Opción 2: `DIAS_POR_MES = 30` en `shared/util/format.util.ts` (`addDaysToTerm`), documentada como regla contable del negocio. La eventual corrección es la deuda TD-010 del [MIGRATION_PLAN](../../info/MIGRATION_PLAN.md#4-deuda-técnica-no-implementar-en-esta-migración).

## Consecuencias

- (+) Paridad de resultados con el sistema en producción; sin sorpresas en actas.
- (−) Diferencias de días acumuladas frente al calendario real en plazos largos.
- Si negocio decide cambiarla, el punto único de cambio es `format.util.ts` y este ADR se reemplaza.
- **La regla NO significa "todo plazo son meses"** (precisión del 2026-08-24). Un contrato puede estar pactado **en días** —el de referencia, 653/2025, son 315 días con `UnidadEjecucion: "Dia(s)"`— y entonces su número no se multiplica por 30. `termToDays` es la **única** lectura de un plazo y respeta la unidad de cada grupo; `addDaysToTerm` la usaba a medias (leía el primer número asumiendo meses) y devolvía 9.462 días donde iban 327, tanto en el formulario como en el `nuevo_plazo_contrato` impreso en el acta. Corregido apoyando `addDaysToTerm` en `termToDays`, con una prueba de invariante que exige `termToDays(addDaysToTerm(t, d)) === termToDays(t) + d`.
- **Un plazo pactado en días se devuelve en días.** Convertir 327 días a "DIEZ ( 10 ) MESES Y VEINTISIETE ( 27 ) DÍAS" es equivalente bajo esta regla, pero cambiaría la unidad del plazo en un documento legal respecto a como se pactó el contrato.
- **La regla cubre también las suspensiones** (consulta a negocio del **2026-08-29**). Se planteó
  contarlas en días de calendario —una suspensión *pausa* el contrato, así que 12 días suspendido
  significan reiniciar al día 13— y se llegó a implementar, pero negocio decidió **mantener la
  funcionalidad del legado**: la aritmética de 30 días se aplicó en su momento con el contexto
  normativo de entonces, y divergir ahora rompería la paridad con el sistema en producción y con
  las actas ya emitidas. El cambio se revirtió el mismo día.

  La diferencia concreta, para cuando alguien vuelva sobre esto: del 10/02 al 05/03 la regla
  contable da **26** días y el calendario **24**. Si algún día se corrige, el punto único sigue
  siendo `periodDays` (y `DIAS_POR_MES` para los plazos).

