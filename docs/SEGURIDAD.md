# Seguridad — novedades_mf

**Fecha**: 2026-10-19 · **Rama**: `feature/contratos`

Validación previa al despliegue según la guía institucional *Checklist de validación y verificación
de seguridad previo al despliegue de aplicaciones* (`lineamientos_oas`, `qa/validación_seguridad.md`):
la información de entrega a Seguridad (§3 de la guía), el Checklist 1 con su evidencia (§2), el
resultado del análisis de código (§4.1) y el de dependencias (§4.2). Al final, las observaciones
conocidas que Seguridad debe tener presentes, con su tratamiento.

## 1. Entrega a Seguridad

| Información | Valor |
|---|---|
| Nombre de la aplicación | `novedades_mf`: novedades poscontractuales (adición/prórroga, suspensión, reinicio, cesión, terminación anticipada y póliza tras cesión) sobre contratos suscritos. Microfrontend Angular montado en `/novedades` dentro de `gestion_contractual_root_mf` (ARGO) |
| URL/dominio de pruebas | Aún no desplegado. El build de pruebas está configurado para `https://pruebasnovedades.portaloas.udistrital.edu.co/` ([ADR-010](adr/ADR-010-deployurl-por-ambiente.md)), por confirmar con Infraestructura al registrar el despliegue |
| Repositorio | `https://github.com/udistrital/novedades_mf` |
| Arquitectura | [ARCHITECTURE.md](ARCHITECTURE.md) y las decisiones en [adr/](adr/) |
| Usuarios/roles | Qué roles ven el módulo lo define la configuración de menús del shell (`core_mf_cliente`), no este repositorio. Dentro del módulo, un usuario cuyo único rol de negocio es `SUPERVISOR` solo tramita y anula novedades de los contratos que supervisa; los demás roles con acceso (ordenador del gasto, asistente jurídica) no tienen esa restricción. Las credenciales de prueba se entregan por canal privado, nunca en el repositorio |
| Tecnologías utilizadas | Ver [Tecnologías](#tecnologías) |
| APIs | No aplica: el MF no expone APIs. Consume las de la tabla [APIs que consume](#apis-que-consume), documentadas en sus propios repositorios |
| Manuales/instructivos | [MANUAL_USUARIO.md](MANUAL_USUARIO.md) |

### Tecnologías

| Componente | Versión | Uso |
|---|---|---|
| Angular | 18.2 | Framework (standalone, signals, zoneless). Por qué la 18 y estado de su soporte: [ADR-001](adr/ADR-001-reescritura-angular18.md) |
| single-spa / single-spa-angular | ≥ 4 / 9.2 | Integración con el shell como microfrontend UMD ([ADR-002](adr/ADR-002-parcel-single-spa.md)) |
| Angular Material / CDK | 18.2 | Solo iconos y autocompletado |
| Tailwind CSS | 3.4 | Estilos, acotados al elemento `novedades-mf` ([ADR-017](adr/ADR-017-css-acotado-al-host.md)) |
| RxJS / TypeScript | 7.8 / 5.5 | — |
| Karma + Jasmine, ESLint (angular-eslint) | 6.4, 5 / 9 | Pruebas y análisis estático en desarrollo |
| Node.js | 24 | Build (imagen `node:24-alpine` del pipeline institucional) |

### APIs que consume

Todas por `https` a través del gateway `autenticacion.portaloas.udistrital.edu.co/apioas/`, con
nombres institucionales en `src/environments/`:

| Variable | API |
|---|---|
| `ADMINISTRATIVA_PRUEBAS_SERVICE` | `administrativa_amazon_api`: contratos, proveedores, estados del contrato |
| `NOVEDADES_MID_SERVICE` | `novedades_mid`: novedades, réplica, anulación, gestor documental |
| `NOVEDADES_SERVICE` | `novedades_crud`: persistencia de novedades |
| `CORE_AMAZON_SERVICE` | `core_amazon_crud`: entidades aseguradoras |
| `FINANCIERA_JBPM_SERVICE` | `financiera_jbpm`: CDP y CRP que imprime el acta |
| `ACTAS_MID_SERVICE` | Generación del PDF del acta (`novedad/generaracta` de `novedades_mid`). **Temporal**: ver [observación 1](#5-observaciones-conocidas) |

## 2. Checklist 1 — Validación previa

| Ítem de la guía | Estado | Evidencia |
|---|---|---|
| El código fuente se encuentra en el repositorio de la universidad | ✅ | `github.com/udistrital/novedades_mf` |
| No existen contraseñas, tokens, API Keys o secretos en el código | ✅ | Búsqueda en los archivos versionados **y en todo el historial**: ningún JWT ni credencial. Hubo un `src/app/shared/http/dev-token.ts` para pruebas locales (en el historial del 2026-07-06 al 2026-09-02); en todas sus versiones su valor fue `''`, y se eliminó ([ADR-009](adr/ADR-009-autenticacion-delegada.md)). Los environments solo tienen URLs públicas y el `CLIENTE_ID` OAuth del shell, que es público por diseño: el flujo es implícito (`id_token token`) y no hay client secret |
| No existen llaves privadas o certificados sensibles expuestos | ✅ | Ningún `.pem`, `.key`, `.p12`, `.pfx`, `.crt`, `.cer`, `.jks` ni `.env` en el repositorio ni en su historial |
| Pruebas funcionales realizadas | ✅ | 222 pruebas automáticas en verde (Karma/Jasmine, 2026-10-19): reglas de negocio, mappers, servicios HTTP, guard de rutas, generación del acta y manejo de errores. Plan de pruebas manual ejecutado en el navegador contra las APIs institucionales: las cinco novedades con su acta, la póliza, un rechazo del generador de actas y el generador apagado (2026-10-09); los formularios, otra vez el 2026-10-19 |
| Formularios y entradas validados | ✅ | Campos obligatorios, mínimos, patrón y longitud con validadores de Angular; topes de adición y de prórroga calculados por las reglas del dominio; fechas en dd/mm/aaaa que deben existir; dinero solo en pesos enteros. Un formulario inválido no abre la confirmación. Los payloads se arman en un único mapper. El backend valida de nuevo (el generador de actas responde 422 con el campo y el motivo) |
| Validación de autenticación | ✅ | Delegada al shell ([ADR-009](adr/ADR-009-autenticacion-delegada.md)): el MF nunca inicia OAuth. El interceptor lee el token del `localStorage` en cada petición y lo adjunta como `Bearer` **solo** a las cinco APIs institucionales de la tabla anterior (allowlist), así que no viaja a terceros. El gateway WSO2 valida el token; sin uno válido las llamadas fallan y la pantalla muestra el error con un código para soporte |
| Validación de usuarios | ✅ con observación | La identidad (`documento`, `email`, `role`) sale de los claims del JWT, decodificados en el cliente sin verificar firma: solo deciden qué muestra la UI. Ver [observación 2](#5-observaciones-conocidas) |
| Validación de roles y permisos | ✅ con observación | El guard de las rutas de creación y el menú del contrato aplican la **misma** regla: rol (restricción de `SUPERVISOR`) y estado del contrato (solo las novedades que su estado admite). Es control de la interfaz; ver [observación 3](#5-observaciones-conocidas) |
| Variables de entorno configuradas correctamente | ✅ con observación | Tres archivos en `src/environments/` (local, pruebas, producción) con los nombres institucionales `*_SERVICE`, URLs `https` y sin secretos. Las URLs de las APIs son las mismas en los tres, igual que en el cliente legado: qué ambiente de backend atiende cada una lo define el gateway. Excepción: `ACTAS_MID_SERVICE`, ver [observación 1](#5-observaciones-conocidas) |
| La arquitectura de la aplicación está documentada | ✅ | [ARCHITECTURE.md](ARCHITECTURE.md) (capas, flujos, ciclo de vida single-spa) y 20 decisiones en [adr/](adr/) |
| Las APIs están documentadas cuando corresponda | No aplica | El MF no expone APIs; las que consume están documentadas en sus repositorios |

## 3. Análisis de código (SonarQube)

`sonar-project.properties` sigue la plantilla del lineamiento (`generacion_de_apis/cicd/`). El
análisis en el servidor de la OAS corre en el pipeline de Drone, que aún no está registrado; mientras
tanto se corrió en local (2026-10-18, SonarQube Community Build 26.10, perfil por defecto "Sonar way"),
así que el resultado es un adelanto y el perfil institucional puede tener otras reglas.

| Métrica | Resultado |
|---|---|
| Bugs | 0 |
| Vulnerabilidades | 0 |
| Security hotspots | 0 |
| Duplicación | 1,6 % |
| Líneas de código | 6234 |

El primer análisis encontró 29 bugs, todos corregidos sin desactivar reglas: 4 menores en el código y
25 avisos de "input sin label", que salían porque el `<label for>` lo dibujaba un componente aparte y
el análisis revisa cada HTML por separado (el label pasó a la plantilla de cada página). Queda un code
smell, a propósito: la expresión regular que da formato a los números de documento, señalada por
posible backtracking. Solo procesa números de documento de pocos dígitos, así que no hay riesgo real.

## 4. Análisis de dependencias

`npm audit` sobre `package-lock.json` (2026-10-19; usa la misma base de avisos de GitHub que
Dependabot). Cuenta paquetes afectados, no avisos.

| Severidad | Paquetes | De ellos, en el árbol de producción |
|---|---|---|
| Crítica | 2 | 0 |
| Alta | 40 | 4 |
| Moderada | 25 | 7 |
| Baja | 7 | 1 |
| **Total** | **74** | **12** |

**Posibilidad de actualización**: ningún aviso se corrige sin subir de versión mayor (`npm audit fix`
ya se aplicó y no queda nada que arregle). Todos piden Angular 21–22 y sus herramientas, Tailwind 4 o
cambiar Karma, es decir, la migración de framework descrita en "Estado del soporte" de
[ADR-001](adr/ADR-001-reescritura-angular18.md).

### 4.1 Qué llega al navegador

Según las estadísticas de webpack del build de producción, el bundle contiene solo código de: Angular
(`animations`, `cdk`, `common`, `core`, `forms`, `material`, `platform-browser`, `router`), `rxjs`,
`tslib`, `single-spa-angular`, los helpers de `@babel/runtime` y los runtimes de `css-loader` y
`style-loader`.

De los 12 paquetes del árbol de producción:

- **Con avisos propios y en el bundle**: `@angular/common`, `@angular/core` y `@angular/router`.
- **`@angular/compiler`**: no llega al bundle (la compilación es AOT), pero genera el código de las
  plantillas, así que sus avisos se evalúan contra las plantillas. Con los tres anteriores suman 18
  avisos, analizados en 4.2.
- **Marcados solo por depender de los anteriores**, sin avisos propios: `animations`, `cdk`, `forms`,
  `material`, `platform-browser` y `platform-browser-dynamic`.
- **`ajv` y `webpack`**: herramientas de build que entran al árbol de producción como dependencias de
  `style-loader`, que pide `single-spa-angular`. No llegan al bundle: los avisos de `webpack` son de
  `buildHttp` (no se usa) y el de `ajv` de su opción `$data` (no se usa).

### 4.2 Avisos del framework y por qué no son alcanzables

Ninguno tiene parche en la línea 18. Cada uno exige una función o una construcción que este MF no
usa (verificado con búsquedas en `src/`):

| Avisos | Severidad | Qué exige para ser explotable | En este MF |
|---|---|---|---|
| GHSA-39pv-4j6c-2g6v, GHSA-q6f4-qqrg-jv6x, GHSA-jhpw-976m-542j, GHSA-p297-fm68-3q8c (`HttpTransferCache`); GHSA-rgjc-h3x7-9mwg (hidratación); GHSA-ff3f-86qr-9cv3 (router en SSR) | 5 altas, 1 moderada | Renderizado en servidor (SSR) con hidratación o caché de transferencia | El MF solo corre en el navegador: sin `@angular/ssr`, `provideClientHydration` ni `withHttpTransferCache` |
| GHSA-g93w-mfhg-p222, GHSA-prjf-86w9-mfqv, GHSA-jj27-h5hq-8x99 | 3 altas | Plantillas con i18n (`i18n-*`) o archivos de traducción de menor confianza | Sin atributos `i18n` ni `$localize`: la interfaz es monolingüe |
| GHSA-jrmj-c5cx-3cw6, GHSA-v4hv-rgfq-gp49 | 2 altas | Bindings con datos no confiables sobre atributos de `<script>` SVG, animaciones SVG o atributos URL de SVG/MathML | Ninguna plantilla tiene SVG ni MathML |
| GHSA-f3m7-gqxr-g87x, GHSA-692r-grfm-v8x7 | 2 moderadas | Compilar en tiempo de ejecución plantillas con entrada del usuario, o crear componentes dinámicos sobre un host elegido por el atacante | Plantillas compiladas AOT desde el repositorio; sin `createComponent` ni `ViewContainerRef` |
| GHSA-58w9-8g37-x9v5 | Moderada | Binding de doble vía (`[(…)]`) sobre una propiedad sensible del DOM (`innerHTML`, `src`, `href`…) | Los únicos bindings de doble vía son `[(fontSize)]`, un número sobre un componente propio |
| GHSA-hh8m-fm6v-7cvg | Moderada | Host bindings de directivas sobre atributos sensibles (`[attr.href]`, `src`, `action`…) | Las tres declaraciones `host` del código (dos directivas y un componente) solo ponen clases y atributos estáticos (`inputmode`, `autocomplete`) |
| GHSA-48r7-hpm6-gfxm | Alta | `DatePipe`/`formatDate` con un formato largo controlado por el usuario | No se usan; las fechas se formatean con funciones propias |
| GHSA-p3vc-36g9-x9gr | Alta | `DecimalPipe`/`CurrencyPipe` con un `digitsInfo` controlado por el usuario | `CurrencyPipe` siempre con el literal `'1.0-0'` en la plantilla |
| GHSA-58c5-g7wp-6w37 | Alta | Peticiones de `HttpClient` a URLs protocol-relative (`//host`) que controle el atacante, con protección XSRF por cookie | Todas las peticiones van a URLs absolutas de los environments; ninguna empieza por `//` |

Además, el código no usa `innerHTML`, `bypassSecurityTrust*`, `DomSanitizer`, `eval` ni
`new Function`: todo lo que se pinta pasa por la interpolación de Angular, que escapa el contenido.

### 4.3 Herramientas de desarrollo y build

Los otros 62 paquetes (entre ellos los 2 críticos) son la CLI, el builder, el servidor de desarrollo,
Karma, Tailwind y ESLint. Corren en la máquina del desarrollador y en el contenedor de build; nada de
ellos llega al navegador del usuario.

- **`piscina`** (crítico; pool de workers del builder de Angular): gadget de *prototype pollution* que
  solo se vuelve ejecución de código si otra parte del proceso de build ya contamina el prototipo.
- **`tar`** (crítico; lo usa la CLI al instalar paquetes): extracción de archivos `.tar` maliciosos.
  El build de producción no extrae archivos `.tar`.

**Tratamiento**: riesgo aceptado hasta la migración de framework. El impacto se limita a la cadena de
build, no a los usuarios de la aplicación.

## 5. Observaciones conocidas

| # | Observación | Severidad | Tratamiento |
|---|---|---|---|
| 1 | **El generador de actas aún no está desplegado.** `ACTAS_MID_SERVICE` apunta a `http://localhost:8081/v1/` en los tres environments, porque `novedad/generaracta` solo corre local (rama `feature/actas` de `novedades_mid`). El acta se genera antes de registrar la novedad, así que en un ambiente desplegado no se puede crear ninguna. El token **no** viaja a esa dirección: no está en la allowlist del interceptor | Bloqueante para el despliegue | Cuando `novedades_mid` se despliegue con `generaracta`, la llamada pasa a `NOVEDADES_MID_SERVICE` (misma ruta, ya en la allowlist) y la variable se elimina ([ADR-020](adr/ADR-020-acta-generada-en-novedades-mid.md)) |
| 2 | **El usuario de los registros lo envía el cliente.** Al crear, anular o cambiar el estado de un contrato, el campo de usuario (`CC{documento}`) sale del claim `documento` decodificado en el navegador, como en el cliente legado. Quien edite su `localStorage` puede alterarlo | Media | Corresponde al backend tomar el usuario del token validado por el gateway, no del cuerpo de la petición |
| 3 | **Las reglas de autorización de negocio viven en el cliente.** La restricción del `SUPERVISOR` y la de "la novedad que el estado del contrato admite" las aplican el guard y el menú. `novedades_mid` reenvía el token pero no verifica rol ni supervisor, y del estado solo valida el cambio en suspensión, terminación y reinicio. Una petición armada a mano contra la API se salta ambas | Media | Corresponde al backend (`novedades_mid`) validar rol, supervisor y estado en los cinco tipos. El guard del MF evita errores y datos inconsistentes, pero no es un control de seguridad |
| 4 | **Angular 18 está fuera de soporte** y arrastra los avisos de la sección 4 | Baja (ninguno alcanzable) | Migración progresiva como trabajo futuro, ya con soporte oficial de `single-spa-angular` ([ADR-001](adr/ADR-001-reescritura-angular18.md)) |

### Desviaciones declaradas de los lineamientos

- **`zone.js` fuera de `polyfills`**: la app es zoneless y el root provee zone.js
  ([ADR-002](adr/ADR-002-parcel-single-spa.md), [ADR-003](adr/ADR-003-standalone-zoneless-signals.md)).
- **Paleta de Material**: tema propio (`azure`/`blue`) acotado al MF, en vez de las variables
  `--md-primary-*` que publica el root. Pendiente de validar si se exige.
- **Angular 18 y `single-spa-angular` 9**: ver observación 4.
