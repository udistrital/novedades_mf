# Registro cronológico de decisiones

Índice para entender la evolución del proyecto de un vistazo. Las decisiones arquitectónicas tienen ADR propio en [adr/](adr/); las operativas se registran solo aquí con su evidencia. Fechas tomadas del historial git y de los documentos de auditoría; cuando la fecha es inferida se indica.

| Fecha | Decisión | Registro | Evidencia |
|---|---|---|---|
| 2026-06-09 | Creación del repositorio; README institucional inicial | — | commits `133f8b9`, `d208e26` |
| 2026-06-30 | Reescritura del módulo de novedades en Angular 18 (no upgrade de AngularJS) | [ADR-001](adr/ADR-001-reescritura-angular18.md) | scaffold `7bc82fa`; requerimientos §12.1 |
| 2026-06-30 | Standalone + zoneless + signals desde el inicio | [ADR-003](adr/ADR-003-standalone-zoneless-signals.md) | `app.config.ts` del scaffold |
| 2026-06-30 | DDD por capas, dominio único `contratos` | [ADR-004](adr/ADR-004-ddd-dominio-unico.md) | commits por capa `febbf58`→`52becff` |
| 2026-06-30 | Puerto `IContractRepository` + mock como implementación inicial | [ADR-005](adr/ADR-005-repositorio-como-puerto.md) | `e872805` |
| 2026-06-30 | Estado de UI con signals en servicios de aplicación (sin NgRx) | [ADR-006](adr/ADR-006-estado-con-signals.md) | `e760403` |
| 2026-06-30 | Tailwind con tokens Stitch; Preflight desactivado con reset acotado al host; Material puntual | [ADR-007](adr/ADR-007-tailwind-tokens.md) | `dd65c55`; `tailwind.config.js`, `styles.css` |
| 2026-06-30 | Clase base `CreateNoveltyPage` para las 5 páginas de novedad | [ADR-008](adr/ADR-008-clase-base-paginas-novedad.md) | `52becff` |
| 2026-06-30 | Integración como parcel single-spa bajo `/novedades`; zone.js del root | [ADR-002](adr/ADR-002-parcel-single-spa.md) | `ebb5fc8`, `d0ea78b` |
| 2026-06-30 | Habilitación de SSR *(decisión revertida — ver 2026-07-06)* | — | `dbc3f2c` |
| 2026-06-30 | Variables de entorno con nombres institucionales, 3 ambientes | — | `3b56a2b`; lineamiento `parcel.md` |
| 2026-07-05 | Búsqueda con criterio obligatorio y excluyente (número ⊻ contratista), vigencia opcional | — | `229daea`, `3eff61d`; regla en [DOMAIN.md](DOMAIN.md) |
| 2026-07-06 | Conexión de **lecturas** al backend real; escrituras quedan simuladas por fases | [ADR-011](adr/ADR-011-escrituras-simuladas.md) | `81dc395` |
| 2026-07-06 | Interceptor de auth: token leído por petición y **allowlist** de APIs institucionales | [ADR-009](adr/ADR-009-autenticacion-delegada.md) | auditoría interna (it. 4) |
| 2026-07-06 | Eliminación del scaffold SSR (nunca tuvo target de build) y archivos muertos; −4 dependencias | — | `1fa1a7b`; [MIGRATION.md](MIGRATION.md#inconsistencias-históricas-conocidas) |
| 2026-07-06 | Adopción de ESLint (angular-eslint, flat config) con prefijo `app` como convención | — | `eslint.config.js`; compliance it. 7 |
| 2026-07-06 | Regla "mes = 30 días" preservada del legado hasta pronunciamiento de negocio | [ADR-012](adr/ADR-012-regla-mes-30-dias.md) | `format.util.ts`; TD-010 |
| 2026-07-07 | Auditoría de cumplimiento vs lineamientos OAS y proyecto guía; equivalencias documentadas (standalone vs NgModules, interceptor vs RequestManager, sin guard inerte, sin i18n) | [COMPLIANCE_REPORT](../referencias/COMPLIANCE_REPORT.md) §4 | informe completo |
| 2026-07-07 | `deployUrl` por ambiente con URL pública real (H1) | [ADR-010](adr/ADR-010-deployurl-por-ambiente.md) | `angular.json` |
| 2026-07-07 | Ruta comodín `**`→dashboard, `ignoreWarnings` style-loader, `sonar-project.properties`, README institucional completado (H2, H5–H7) | — | compliance, registro de migración |
| 2026-07-07 | **Exclusiones por decisión del equipo**: tema Material institucional (H3) y ampliación de cobertura de pruebas (H4) quedan fuera del alcance actual | — | compliance (⛔) |
| 2026-07-07 | Plan de migración funcional vs legado: 48 requerimientos evaluados, backlog MIG-001..014, deuda TD-001..010, supuesto de alcance del MF documentado | [MIGRATION_PLAN](../MIGRATION_PLAN.md) | plan completo |
| 2026-07-07 | Pasada de documentación TSDoc orientada a intención + creación de `docs/` como base de conocimiento oficial | — | commit `e5370e8` y posteriores |

## Cómo mantener este registro

Una fila por decisión relevante (arquitectura, alcance, convención, exclusión), con fecha y evidencia. Si la decisión es estructural o costosa de revertir → ADR propio y enlace aquí. Las decisiones revertidas no se borran: se anotan (ver SSR, 2026-06-30) — el registro es memoria, no foto.
