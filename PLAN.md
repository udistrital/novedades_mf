# PLAN de mejoras — auditoría completa (2026-07-06)

Auditoría de todo el código (`src/`, configuración de build, dependencias).
Estado general: la arquitectura DDD, el uso de Signals/control flow de Angular 18
y la integración single-spa están bien resueltos. Los hallazgos son principalmente
**scaffold muerto del CLI**, dependencias sin uso y pequeñas duplicaciones.

Leyenda: 🔴 Alto · 🟡 Medio · 🟢 Bajo — Estado: ⬜ Pendiente · 🔄 En progreso · ✅ Completada

## Matriz Impacto × Esfuerzo (orden de ejecución)

| # | Mejora | Gravedad | Impacto | Esfuerzo | Estado |
|---|--------|----------|---------|----------|--------|
| 1 | Eliminar scaffold SSR muerto y sus 4 dependencias | 🔴 | Alto | Bajo | ✅ |
| 2 | Eliminar archivos muertos (`main.ts`, `empty-route`, `asset-url`, `set-public-path`, `single-spa-props`, `ContractStatus`, css vacío) | 🔴 | Alto | Bajo | ✅ |
| 3 | Reparar `app.component.spec.ts` (2 tests rotos del scaffold) y quitar `title` sin uso | 🟡 | Medio | Bajo | ✅ |
| 4 | Interceptor auth: adjuntar el token solo a las APIs institucionales | 🟡 | Medio | Bajo | ✅ |
| 5 | Quitar `CommonModule` innecesario (dashboard, accordion) y `OnInit` vacío | 🟢 | Bajo | Bajo | ✅ |
| 6 | Vigencias hardcodeadas en `crear-adicion-prorroga` (drift anual) → compartir generación con el dashboard | 🟡 | Medio | Bajo | ✅ |
| 7 | Añadir tooling de lint (`angular-eslint`) + corregir sus 38 hallazgos | 🟡 | Medio | Medio | ✅ |

## Resultado (2026-07-06)

- `npm run lint` ✅ · `npm run build` ✅ · `npm test` ✅ (2/2)
- −11 archivos muertos, −4 dependencias de producción (`@angular/ssr`, `@angular/platform-server`, `express`, `@types/express`)
- Correcciones derivadas del lint (sin cambio visual):
  - Output `cancel` → `dismiss` en los 2 modales de confirmación (`no-output-native`; `cancel` es un evento nativo del DOM) y sus 6 usos.
  - `modal-shell`: se eliminó el `stopPropagation` interno (ahora `target === currentTarget` en el backdrop), `role="dialog"` + `aria-modal` en el contenido y `role="presentation"` en el backdrop.
  - Dashboard: `label`s asociados con `for`/`id` (vigencia y término); el rótulo del grupo de botones "Buscar por" pasó a `span` (no etiqueta un control de formulario).
  - `eslint.config.js` ajustado a la convención real del proyecto (prefijo `app`, raíz `novedades-mf`) y al noop de ControlValueAccessor.
  - `no-negative-number.directive`: disable puntual documentado (su selector sin prefijo es diseño deliberado).

## Detalle de cada hallazgo

### 1. Scaffold SSR muerto 🔴
- **Problema**: `server.ts`, `src/main.server.ts`, `src/app/app.config.server.ts` y el script
  `serve:ssr:novedades-mf` existen, pero `angular.json` no tiene target de server/SSR:
  el único build es `custom-webpack:browser` con `main.single-spa.ts`. El script apunta a
  `dist/novedades-mf/server/server.mjs`, que nunca se genera.
- **Por qué existe**: restos del `ng new` con SSR antes de convertir el proyecto a single-spa.
- **Impacto**: 4 dependencias sin uso (`@angular/ssr`, `@angular/platform-server`, `express`,
  `@types/express`), instalación más lenta, superficie de confusión ("¿esto tiene SSR?").
- **Riesgo**: ninguno — nada compilado los referencia. Se verifica con build + test.

### 2. Archivos muertos 🔴
- `src/main.ts`: el propio build lo marca "unused" — `main.single-spa.ts` ya hace el
  bootstrap standalone. Se elimina y se quita de `tsconfig.app.json`.
- `src/app/empty-route/`: componente del scaffold single-spa sin referencias.
- `src/single-spa/asset-url.ts`: helper sin referencias (no hay assets propios).
- `src/set-public-path.ts`: no está en la compilación ni se importa; el public path lo fija `deployUrl`.
- `src/single-spa/single-spa-props.ts`: el subject se alimenta en `main.single-spa.ts` pero nadie lo consume (YAGNI; se re-crea si algún día se necesitan props del shell).
- `contract-status.enum.ts` (`ContractStatus`): enum sin ningún uso.
- `app.component.css`: vacío.

### 3. Spec del AppComponent roto 🟡
- **Problema**: 2 de 3 tests son del scaffold (`'Hello, novedades_mf'` en un `<h1>` que no existe;
  propiedad `title` que nadie usa). `npm test` falla.
- **Solución**: spec mínimo que valide creación del componente; quitar `title`.

### 4. Interceptor adjunta el token a TODA petición 🟡
- **Problema**: `authInterceptor` añade `Authorization: Bearer` a cualquier URL saliente.
  Si mañana algún componente hace un fetch a un tercero (fuentes, otro API), filtraría el token.
- **Solución**: adjuntar solo si la URL empieza por alguno de los servicios institucionales de
  `environment` (allowlist de 1 línea). Defensa en profundidad, comportamiento actual idéntico.

### 5. Imports/interfaces innecesarios 🟢
- `CommonModule` en `dashboard-contratos` (no usa nada de él) y en `contract-accordion`
  (ya importa `CurrencyPipe` explícito).
- `OnInit`/`ngOnInit` vacío en el dashboard (el comentario útil se conserva en el sitio correcto).

### 6. Vigencias duplicadas y con drift anual 🟡
- **Problema**: el dashboard genera los años dinámicamente (año actual → 2015), pero
  `crear-adicion-prorroga` tiene `['2026'…'2016']` hardcodeado y `'2026'` como default en 2 sitios.
  En enero de 2027 la lista queda desactualizada silenciosamente.
- **Solución**: helper compartido `yearsFrom2015()` en `shared/util` usado por ambos; default = año actual.

### 7. Sin lint configurado 🟡
- **Problema**: no hay ESLint ni target `lint`; imposible cumplir el ciclo lint+build por iteración.
- **Solución**: `ng add angular-eslint` (solo devDependencies, estándar de la comunidad Angular).

## Propuestas documentadas — NO implementadas (requieren tu decisión)

### P1. `deployUrl: "http://localhost:4209/"` aplica también al build de producción 🔴 (decisión de despliegue)
`angular.json` define `deployUrl` en `options` (común a todas las configuraciones), así que el
bundle **de producción** emite referencias de chunks apuntando a `http://localhost:4209/`.
Si el MFE ya se despliega en algún entorno real, esto rompería la carga de chunks lazy salvo
que el shell lo sirva exactamente ahí. Opciones:
- Mover `deployUrl` a la configuración `development` y restaurar `src/set-public-path.ts`
  (import en la primera línea de `main.single-spa.ts`) para que el public path se derive en
  runtime de la URL del bundle — patrón estándar single-spa, funciona en cualquier host.
- O parametrizar `deployUrl` por configuración con la URL real de producción.
**No lo cambio sin conocer cómo el shell importa este MFE en producción.**

### P2. Tests zoneless (quitar `zone.js`)
La app es zoneless (`provideExperimentalZonelessChangeDetection`), pero karma aún carga
`zone.js` como polyfill. Se puede migrar el TestBed a zoneless y eliminar la dependencia.
Beneficio: 1 dependencia menos (solo dev; no afecta al bundle). Coste: tocar config de test.
Baja prioridad.

### P3. `ChangeDetectionStrategy.OnPush` en todos los componentes
Con zoneless + signals el beneficio de rendimiento es marginal (el scheduler ya trabaja por
notificación). Añadirlo es idiomático pero no aporta beneficio medible hoy. No se aplica
("no optimizaciones prematuras"); recomendable si el proyecto vuelve a zone.js algún día.

### P4. Fuentes externas duplicadas
`index.html` (standalone) carga Roboto + Material Icons; `styles.css` carga Material Symbols +
Inter desde Google Fonts. Montado en el shell, `index.html` no aplica: **el shell debe proveer
Material Icons** o los `<mat-icon>` mostrarán ligaduras de texto. Verificar en el shell; si no
las provee, mover la carga de Material Icons a `styles.css`.

## Hallazgos revisados y descartados (sin acción)

- **Seguridad XSS**: no hay `innerHTML`, `bypassSecurityTrust` ni `eval`. ✔
- **Token en localStorage**: patrón heredado del shell/cliente legado; no es decisión de este MFE.
- **`console.warn` en `HttpContractService`**: marcadores deliberados de escrituras aún no
  conectadas (documentados con TODO); se quitan al conectar los POST/PATCH.
- **`dev-token.ts`**: hook de pruebas documentado con instrucciones de borrado; token vacío. OK temporal.
- **`environment.NOVEDADES_SERVICE` / `TOKEN` sin uso en código**: nombres institucionales
  reservados para la fase de escrituras y para el OAuth del shell. Se mantienen.
- **Suscripciones RxJS**: todas las de larga vida usan `takeUntilDestroyed`; las de servicios son
  one-shot de HttpClient (se completan solas). ✔
- **Botón "Contactar Soporte"** en `novelty-error` no tiene acción: parece decisión de diseño
  pendiente de definir; no se toca la UI.
- **Duplicación buildDraft/buildSummary entre páginas**: es mapeo tipado explícito, no lógica;
  abstraerlo costaría más legibilidad de la que ahorra.
- **Templates**: 100 % control flow nuevo (`@if/@for`), sin `*ngIf/*ngFor`. ✔
- **Lazy loading**: todas las rutas usan `loadComponent`. ✔
