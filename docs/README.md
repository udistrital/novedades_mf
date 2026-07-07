# Documentación técnica — novedades_mf

Base de conocimiento oficial del proyecto. Todo cambio futuro (humano o de agente de IA) debe tomar esta carpeta como referencia.

## Qué es este proyecto

Microfrontend Angular 18 para gestionar **novedades poscontractuales** (adición y prórroga, suspensión, reinicio, cesión, terminación anticipada) sobre contratos suscritos de la Universidad Distrital Francisco José de Caldas. Es la **reescritura** del módulo legal del cliente AngularJS `novedades_cliente` (ver [MIGRATION.md](MIGRATION.md)) y se integra como *parcel* de [single-spa](https://single-spa.js.org/) en el shell `gestion_contractual_root_mf`, con `core_mf_cliente` proveyendo layout, autenticación y menú.

## Stack

Angular 18 (standalone, signals, zoneless) · single-spa / single-spa-angular 9.2 · Angular Material 18 (uso puntual) · TailwindCSS 3.4 con design tokens propios · TypeScript 5.5 estricto · RxJS 7.8 · ESLint (angular-eslint, flat config).

## Arquitectura en una frase

DDD por capas dentro de `src/app/domains/contratos/` — `domain/` (puro), `application/` (casos de uso + estado con signals), `infrastructure/` (HTTP + DTOs + mappers), `presentation/` (páginas y componentes) — más átomos transversales en `src/app/shared/`. Detalle completo en [ARCHITECTURE.md](ARCHITECTURE.md).

## Ejecución y comandos

Los pasos completos (Root + Core + MF) están en el [README raíz](../README.md). Comandos del día a día:

| Comando | Uso |
|---|---|
| `npm start` | Dev server en `http://localhost:4209` (ambiente local) |
| `npm run start:test` | Dev server con ambiente de pruebas |
| `npm run build` | Build de producción (deployUrl institucional) |
| `npm run lint` | ESLint (obligatorio en verde antes de commit) |
| `npm test` | Karma + Jasmine |

El artefacto es un UMD (`dist/novedades-mf/main.js`) que el root importa; en modo standalone `src/index.html` monta el mismo componente raíz para desarrollo aislado.

## Estructura general

```
src/
├── main.single-spa.ts        # Entry point único: lifecycles single-spa + bootstrap standalone
├── app/
│   ├── app.config.ts         # Providers compartidos; binding IContractRepository → impl activa
│   ├── app.routes.ts         # Rutas lazy del dominio + comodín
│   ├── shared/               # http/ (interceptor) · ui/ (átomos Stitch) · util/ (formatos)
│   └── domains/contratos/    # Único dominio (4 capas DDD)
├── environments/             # environment(.development|.test).ts — nombres institucionales
backend/                      # Contratos de las APIs legadas (endpoints, ejemplos Postman)
referencias/                  # Requerimientos del legado, compliance vs lineamientos OAS
```

## Índice de la documentación

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Capas DDD, flujos de datos y navegación, ciclo de vida single-spa |
| [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) | Manual práctico: cómo crear componentes, casos de uso, mappers, endpoints |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Convenciones, uso de signals/Material/Tailwind, anti-patrones |
| [DOMAIN.md](DOMAIN.md) | El negocio: conceptos, reglas y vocabulario de novedades poscontractuales |
| [MIGRATION.md](MIGRATION.md) | Origen AngularJS, qué se migró, qué falta, deuda técnica |
| [adr/](adr/) | Decisiones de arquitectura individuales (ADR-001…) |
| [DECISION_LOG.md](DECISION_LOG.md) | Índice cronológico de decisiones |
| [AI_GUIDE.md](AI_GUIDE.md) | Reglas operativas para agentes de IA |
| [GLOSSARY.md](GLOSSARY.md) | Términos técnicos y de negocio |

Documentos operativos fuera de `docs/`: [`MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) (backlog MIG-XXX vigente) y [`referencias/COMPLIANCE_REPORT.md`](../referencias/COMPLIANCE_REPORT.md) (cumplimiento de lineamientos OAS).
