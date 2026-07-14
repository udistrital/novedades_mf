# Contexto de migración

Memoria histórica del proyecto: de dónde viene, qué se decidió al migrar y qué falta. El backlog accionable vive en [`MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) (raíz del repo) — este documento explica el contexto; aquel, las tareas.

## Origen

El sistema anterior es `novedades_cliente`: AngularJS 1.7.9, Bootstrap 3, build Grunt+Bower, ES5, dentro del cliente monolítico "Argo" de gestión contractual. Sus requerimientos funcionales fueron levantados leyendo su código fuente (no documentación) y están en [`referencias/requerimientos_novedades_original.md`](../referencias/requerimientos_novedades_original.md). Conclusión de ese levantamiento: el stack no tenía ruta de actualización incremental — la migración es una **reescritura** ([ADR-001](adr/ADR-001-reescritura-angular18.md)) dentro de la nueva arquitectura de microfrontends institucional (root `gestion_contractual_root_mf` + `core_mf_cliente` + MFs por dominio).

## Qué proviene del legado (y cómo)

| Del legado | En el MF actual |
|---|---|
| Reglas de derivación de fechas (reinicio = fin+1, cedente = cesión−1) | Reimplementadas en los formularios ([DOMAIN.md](DOMAIN.md#reglas-del-dominio)) |
| Regla "mes = 30 días" y plazos en letras | Reimplementadas en `shared/util/format.util.ts` ([ADR-012](adr/ADR-012-regla-mes-30-dias.md)) |
| Regla "solo la última novedad es anulable" | Reimplementada en el mapper de novedades |
| APIs backend (Ágora, novedades_mid/crud) y su esquema laxo | Se consumen igual, pero aisladas tras DTOs + mappers ([ADR-005](adr/ADR-005-repositorio-como-puerto.md)) |
| Nombres institucionales de environments (`*_SERVICE`, `TOKEN`) | Conservados tal cual (obligatorio por lineamiento) |
| Token OAuth2 WSO2 en `localStorage` | Mismo canal; ahora lo deposita el shell y el MF solo lo lee ([ADR-009](adr/ADR-009-autenticacion-delegada.md)) |
| Archivos de environment del legado (referencia de dominios/servicios) | Copiados en `referencias/environment*.js` como evidencia |

**Qué NO se migró tal cual**: la UI (rediseñada por completo con design tokens propios), la estructura del código (de controladores AngularJS a DDD por capas), el manejo de estado (de `$scope` a signals) y el mecanismo de menú/roles (pasó al core).

## Decisiones tomadas durante la migración

Todas con ADR propio — índice cronológico en [DECISION_LOG.md](DECISION_LOG.md). Las estructurales: reescritura en Angular 18 (ADR-001), parcel single-spa (ADR-002), standalone+zoneless+signals divergiendo del proyecto guía NgModules (ADR-003), DDD con dominio único `contratos` (ADR-004), puerto de repositorio + anticorrupción (ADR-005), estado con signals (ADR-006), Tailwind con tokens y Material puntual (ADR-007), base común de páginas de novedad (ADR-008), auth delegada (ADR-009), deployUrl por ambiente (ADR-010), **migración por fases con escrituras simuladas** (ADR-011) y conservación de la regla de 30 días (ADR-012).

## Estado actual (2026-07-07, tras la ejecución del plan de migración)

**Implementado y conectado a backend real**: búsqueda de contratos por número o contratista con filtro de vigencia; listado con historial de novedades, **estado real del contrato** (`contrato_estado`) y valor vigente acumulado; menú de acciones gobernado por el mapa estado→acciones (incluye Agregar Póliza y Activar Contrato); bloqueo por novedad En trámite; los 5 formularios de novedad con topes normativos del 50 %, modos independientes de adición/prórroga, topes y saldo de cesión, regla de saldos excluyentes de terminación y límite de 249 caracteres del motivo; **escrituras reales** (crear/anular novedad, activar contrato, registrar póliza — [ADR-014](adr/ADR-014-escrituras-reales-sin-replica.md)); control de acceso por rol SUPERVISOR (acordeón + guard); contratista vigente tras cesión. Detalle tarea por tarea en [REVISION_CAMBIOS.md](REVISION_CAMBIOS.md); plan de pruebas en [TEST_PLAN.md](TEST_PLAN.md).

Los frentes que siguen abiertos, en orden de criticidad:

1. **Validar contra backend los contratos de datos no documentados**: nombres de campo del `POST novedad/` por tipo (`novelty-payload.mapper.ts`) y de las respuestas `GetNovedad*` (`readCandidate` del mapper). Ambos corregibles en un único archivo cada uno.
2. **Réplica hacia Ágora/Titan** (TD-007): decisión de backend; hasta entonces las novedades creadas aquí no se replican en preliquidación.
3. **Actas** (generación/previsualización de PDF): excluida de esta fase por decisión explícita.
4. **Aprobación** (MIG-014): módulo completo, bloqueado por validación de negocio.
5. Ids/avance de estado de "Cesión pendiente de póliza" tras registrar la póliza: sin documentar en el legado (ambigüedad registrada; el backend debería fijarlo).

## Deuda técnica heredada y registrada

Diez ítems TD-001..TD-010 en el [MIGRATION_PLAN §4](../MIGRATION_PLAN.md#4-deuda-técnica-no-implementar-en-esta-migración). Los que condicionan a este MF: funcionalidades-prototipo del legado que requieren re-especificación (Liquidación, Otrosí, consulta transversal, Plantillas), parametrización backend de constantes normativas (SMLMV, topes), transaccionalidad Novedades↔Ágora, y la regla de 30 días pendiente de pronunciamiento jurídico.

## Cambios importantes respecto al sistema anterior

- **De monolito a microfrontend**: el legado era una app completa (menú, auth, notificaciones, reportes, RP, plantillas); este MF cubre solo el dominio de novedades — auth/menú/notificaciones son del core, y RP/reportes se asumen en otros MFs (supuesto de alcance documentado en el MIGRATION_PLAN).
- **Seguridad**: el interceptor solo adjunta el token a las APIs institucionales (el legado lo enviaba a todo); las credenciales SpagoBI hardcodeadas quedaron fuera con su módulo (TD-009).
- **Búsqueda ampliada**: el legado buscaba solo por número+vigencia; el MF agrega búsqueda por contratista con autocomplete (funcionalidad adicional registrada).
- **Calidad de base**: TypeScript estricto, lint obligatorio, arquitectura testeable — nada de esto existía en el legado.

## Inconsistencias históricas conocidas

- El commit `dbc3f2c feat: habilitacion de SSR` (2026-06-30) introdujo scaffold de SSR que **nunca tuvo target de build**; se eliminó en la auditoría del 2026-07-06. El MF no es ni fue SSR en la práctica.
- El README del legado listaba 5 novedades pero solo 3 estaban implementadas de verdad, y omitía 3 que sí lo estaban (suspensión, reinicio, póliza) — por eso la fuente de requerimientos es el código legado, no su README.
- El controlador de Aprobación del legado contiene código roto (variables indefinidas): **no es fuente de verdad** de las reglas de solicitud por rol (advertencia repetida en MIG-014).
