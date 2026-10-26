# ADR-017 — Todo el CSS del MFE acotado al host, con mecanismo por cada capa

**Fecha**: 2026-08-24 · **Estado**: Aceptada (completa a [ADR-007](ADR-007-tailwind-tokens.md))

## Contexto

[ADR-007](ADR-007-tailwind-tokens.md) ya fijó la regla: *"ningún selector global sin anclar a `novedades-mf`"*. Se aplicó al Preflight de Tailwind, que era el caso conocido, y ahí se quedó — la regla estaba escrita pero no se cumplía en el resto del archivo.

El 2026-08-24 apareció la prueba: el footer del shell (`localhost:4200`) rompía el texto "Oficina Asesora de Tecnologías e Información" en tres líneas **solo cuando este MFE estaba montado**, descuadrando toda la franja. En DevTools el estilo ganador venía de `azure-blue.css`, un archivo de este repo.

El mecanismo, confirmado en el bundle:

1. `single-spa-angular/lib/webpack` sustituye la extracción de CSS por `style-loader`: el `styles` global **no** sale como archivo, se empaqueta en el JS y se inyecta como `<style>` en el `<head>` del documento compartido al montar el MFE. Sin Shadow DOM y **de último**, así que gana los empates de especificidad contra el shell.
2. `styles.css` hacía `@import '@angular/material/prebuilt-themes/azure-blue.css'`. Ese tema incluye `mat.typography-hierarchy()`, que emite `.mat-typography h1..h6` y `.mat-headline-*`.
3. El shell es también una app Angular Material y lleva `mat-typography` en el `body`. Su footer tiene un `h5`, así que la regla `.mat-typography h5 { font: 400 1.75rem/2.25rem Roboto; margin: 0 0 .5em }` de **nuestro** tema le aplicaba y le triplicaba el tamaño.

Y no era el único escape. La auditoría del archivo encontró tres más, ninguno reportado porque ninguno es visible de golpe:

- `html, body { height: 100% }` y `body { margin: 0; font-family: Roboto }` — le cambiaban la tipografía al `body` del shell.
- `.material-symbols-outlined`, `.mat-icon.mat-icon`, `details > summary` — clases y elementos sin ámbito.
- Todo el resto del tema precompilado: sus selectores `.mat-*`/`.mdc-*` alcanzaban los componentes Material **del shell**, pisándoles sus tokens de color. Invisible hasta que alguien compara capturas.

## Problema

Que la regla de ADR-007 se cumpla por construcción y no por vigilancia, en las tres capas de CSS que el MFE emite: utilidades Tailwind, tema de Material y CSS propio.

## Decisión

Un mecanismo por capa, ninguno que dependa de acordarse:

| Capa | Mecanismo |
|---|---|
| Utilidades Tailwind | `important: 'novedades-mf'` en `tailwind.config.js` — la estrategia de selector de Tailwind, que emite `novedades-mf .clase` en vez de usar `!important` |
| Tema de Material | `styles.css` → `styles.scss`; el precompilado se reemplaza por los mixins por componente (`mat.icon-theme`, `mat.autocomplete-theme`, `mat.option-theme`, `mat.optgroup-theme`, `mat.core-theme`, `mat.ripple-theme`) dentro de un bloque `novedades-mf { … }` |
| CSS propio | Escrito bajo el mismo bloque; las reglas de `html`/`body` se mudan a `src/index.html`, que solo existe en el arranque standalone |

**No se incluye `mat.typography-hierarchy()`**, que es la que rompía el footer. No es una omisión defensiva: el MFE nunca la usó — `main.single-spa.ts` ya omitía `class="mat-typography"` a propósito porque esas reglas le ganaban por especificidad a las utilidades Tailwind. Tampoco se usa `all-component-themes`: de los treinta y tantos componentes de Material, este MFE usa dos.

**Los overlays del CDK se montan dentro del host** (`ScopedOverlayContainer`, provisto sobre `OverlayContainer`). Sin esto el ámbito no podría ser único: el CDK cuelga `.cdk-overlay-container` de `<body>`, así que el panel del autocomplete de contratista quedaría fuera de `novedades-mf` y perdería tanto los tokens del tema como las utilidades Tailwind de sus opciones. La alternativa —acotar el CSS también a `.cdk-overlay-container`— se descartó: ese contenedor es del documento, no del MFE, y volvería a pisarle los overlays al shell.

## Consecuencias

- (+) La regla de ADR-007 pasa a ser verificable: **todo** selector emitido contiene `novedades-mf`, salvo dos excepciones medidas e inertes (los valores por defecto `--tw-*` sobre `*`, que son solo definiciones de variables — cero declaraciones reales; y `.mat-theme-loaded-marker`, que Material saca con `@at-root` y el shell emite idéntica).
- (+) El bundle baja: sobraban ~70 kB de tema de componentes que el MFE no usa (442 → 435 kB en producción).
- (+) Deja de haber acoplamiento invisible en los dos sentidos: el shell tampoco puede estilar los overlays del MFE.
- (−) Las utilidades Tailwind suben un nivel de especificidad (`novedades-mf .flex`). Si alguna vez hay que pisarlas desde estilos de componente, hará falta la misma especificidad. No ha pasado.
- (−) `styles.scss` ya no puede recibir un tema precompilado de un tirón: agregar un componente Material nuevo exige agregar su mixin. Es el precio de no volver a inyectar 30 temas para usar dos, y el compilador avisa (el componente sale sin tokens).
- El paso de `.css` a `.scss` obligó a alinear el bloque `test` de `angular.json`, que cargaba el precompilado global aparte: las pruebas corrían con una hoja de estilos distinta a la de la app.
- **Trampa al renombrar el estilo global**: la caché persistente de webpack (`.angular/cache/<versión>/angular-webpack/`) indexa el entry por nombre de archivo y **no se invalida** cuando ese nombre cambia en `angular.json`. Tras el cambio, `ng serve` falla con `Can't resolve 'src/styles.css?ngGlobalStyle'` aunque nada en el repo mencione ya ese archivo — y `ng build` puede pasar, porque usa otro espacio de caché. Se arregla con `rm -rf .angular/cache` y reiniciar el servidor. Aplica a cualquier renombrado futuro de un entry de `styles`/`scripts`.
- Regla operativa: **cualquier CSS nuevo va dentro del bloque `novedades-mf`**. Cómo auditarlo tras un cambio está en la cabecera de `styles.scss`.
