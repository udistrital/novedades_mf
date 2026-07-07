# Estándares de código

Reúne los lineamientos oficiales OAS aplicables al frontend y las convenciones propias del proyecto. El "cómo hacer X" paso a paso está en [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md); aquí está el "qué se considera correcto". El lint (`npm run lint`, angular-eslint flat config) hace cumplir una parte; el resto se revisa en PR.

## Convenciones de nombres

- **Selectores**: componentes y directivas propios con prefijo `app` (`app-card`, `appFormInput`); el único selector distinto es `novedades-mf` (componente raíz, exigido por single-spa). Impuesto por lint. Excepción documentada: `no-negative-number.directive.ts` usa selector sin prefijo (`input[type=number][min]`) porque su diseño es auto-aplicarse — lleva su `eslint-disable` justificado.
- **Clases**: sufijo por rol — `Component`, `Service`, `Directive`. El puerto del repositorio usa prefijo `I` + sufijo `Repository` (`IContractRepository`) aunque sea clase abstracta: comunica su rol de contrato.
- **Idiomas**: código y tipos en inglés (`Contract`, `NoveltySummary`); textos de UI, segmentos de ruta y campos de drafts que viajan al backend legado en español (`fechaSolicitud`, `crear-cesion`). Es deliberado: los drafts hablan el idioma de las APIs institucionales.
- **Archivos/carpetas**: ver la tabla de [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#nombres-de-archivos-y-carpetas).
- **Commits**: etiquetas institucionales `feat:`/`fix:`/`docs:`/`test:`/`refactor:` (lineamiento `etiqueta_commits.md`). Ramas GitFlow (`feature/*`).

## Principios DDD del proyecto

- La **regla de dependencia entre capas** de [ARCHITECTURE.md](ARCHITECTURE.md#capas-ddd) es innegociable; la violación típica a evitar es importar algo de `infrastructure/` desde un componente.
- **Reglas de negocio = funciones puras** en `domain/*.rules.ts`, no métodos de componentes. Si una regla necesita datos de varios objetos, recibe los objetos, no servicios.
- **DTOs ≠ modelos**: nada del esquema del backend se filtra al dominio; la traducción es exclusiva de los mappers (capa anticorrupción, [ADR-005](adr/ADR-005-repositorio-como-puerto.md)).
- **Un dominio, una carpeta**: conceptos de negocios distintos no comparten dominio.

## Angular

- **Standalone siempre**; no introducir NgModules ([ADR-003](adr/ADR-003-standalone-zoneless-signals.md)).
- **Inyección con `inject()`**, campos `private readonly`; no constructores con parámetros de DI.
- **Inputs/outputs con las APIs de señales**: `input()`, `input.required()`, `output()`, `model()`. El código pre-existente con `@Input/@ViewChild` (`contract-accordion`) no es licencia para escribir más.
- **Control flow nuevo** (`@if/@for/@switch` con `track` obligatorio); `*ngIf/*ngFor` no existen en el proyecto y no deben volver. `CommonModule` no se importa: si necesitas un pipe, impórtalo suelto (`CurrencyPipe`).
- **Rutas lazy** con `loadComponent`; ninguna página se importa eagerly.
- **Ciclo de vida**: preferir `takeUntilDestroyed()` (con `DestroyRef` inyectado si es fuera del constructor) sobre implementar `OnDestroy`. No dejar `ngOnInit` vacíos.
- **Zoneless**: no asumir que zone.js dispara change detection; toda reactividad pasa por signals o eventos de template. No llamar `ChangeDetectorRef.detectChanges()` como parche.

## Signals

- Estado mutable **privado**, lectura pública vía `computed`/`readonly` — patrón `ContractStateService`.
- `computed` para derivar, `effect` como último recurso (los criterios exactos y ejemplares están en [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#cómo-usar-signals)).
- **Prohibido `BehaviorSubject` como estado de UI** en componentes/servicios de aplicación; RxJS se reserva para I/O (HTTP, `valueChanges`).
- Un signal cuyo valor puede derivarse de otros es un bug de diseño: conviértelo en `computed`.

## Angular Material

- Uso **puntual y justificado**: `MatIconModule` (iconografía) y `MatAutocompleteModule` (dropdown con teclado/a11y resueltos). La identidad visual del MF no es Material ([ADR-007](adr/ADR-007-tailwind-tokens.md)).
- No introducir componentes Material de superficie (botones, cards, tablas, dialogs) — sus equivalentes ya existen como átomos Tailwind en `shared/ui/` (modal-shell, card, feedback-card…). Un Material nuevo requiere justificar por qué el átomo no basta.
- El theme es el prebuilt `azure-blue` importado en `styles.css`; la migración a paleta institucional está registrada como pendiente excluido (H3 del [COMPLIANCE_REPORT](../referencias/COMPLIANCE_REPORT.md)).

## Tailwind

- **Solo utilidades + tokens del design system** definidos en `tailwind.config.js`: colores semánticos (`primary`, `surface-container-*`, `on-surface-variant`, `error`…), espaciado (`stack-sm/md/lg`, `gutter`, `container-margin-*`) y tipografía (`headline-lg`, `title-md`, `body-md`, `label-sm`… con sus pares `font-*`/`text-*`).
- **No usar colores/valores arbitrarios** (`text-[#333]`, `p-[13px]`) si existe token; los tamaños arbitrarios puntuales (`text-[16px]` en iconos) son la excepción tolerada para `mat-icon`.
- **No escribir CSS suelto**: `styles.css` solo contiene el reset acotado al host y ajustes globales justificados con comentario. Los `styles:` de componente se limitan a lo que Tailwind no expresa (ej. `font-variation-settings`).
- **Preflight está desactivado a propósito** (aislamiento frente al shell — comentario en `tailwind.config.js`): nunca reactivarlo ni agregar selectores globales sin ámbito (`h1 {…}`, `* {…}`); todo selector global nuevo debe anclarse a `novedades-mf`.
- Clases repetidas 3+ veces con significado propio → candidato a átomo en `shared/ui/` o a directiva de estilo (ejemplar: `FormInputDirective`), no a `@apply`.

## Accesibilidad (mínimos exigidos por lint)

`label` asociado a su control (`for`/`id`), elementos con click también operables por teclado (o `role="presentation"` si son decorativos con alternativa de teclado — ejemplar: backdrop de `modal-shell`), `aria-label` en navegaciones, roles de diálogo en modales.

## Documentación en código

TSDoc breve orientado al **por qué** en: clases/servicios (responsabilidad y contexto), entidades (concepto de negocio), funciones públicas con efectos o contratos no obvios (`@param`/`@returns`/`@remarks` solo cuando aportan). No comentar lo evidente; no comentarios de bitácora ("se cambió X"). Los comentarios `ponytail:` marcan simplificaciones deliberadas con su techo conocido — respetarlos o resolverlos, no borrarlos sin más.

## Anti-patrones (rechazo directo en revisión)

1. Componente que inyecta `HttpClient` o `HttpContractService` (salta el puerto).
2. Lógica de negocio en mappers, templates o componentes en lugar de `domain/`.
3. `BehaviorSubject`/`Subject` como estado de vista.
4. `effect` que deriva estado o encadena signals.
5. Estilos globales sin ámbito o Preflight reactivado.
6. Output con nombre de evento nativo (`cancel`, `change`).
7. URLs de API hardcodeadas fuera de `environments/`.
8. `any` en código nuevo del dominio/aplicación (los DTOs laxos del legado son la excepción acotada).
9. Interface con una sola implementación "por si acaso", factory sin segundo producto, abstracción especulativa.
10. `console.log` (los `console.warn` de escrituras simuladas son marcadores temporales de MIG-001).
