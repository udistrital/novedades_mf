# novedades_mf

Microcliente para la gestión, registro, actualización y consulta de novedades poscontractuales de la Universidad Distrital Francisco José de Caldas. Forma parte de la arquitectura de microfrontends del sistema de gestión contractual y se integra en el cliente contenedor mediante [single-spa](https://single-spa.js.org/).

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones

* [Angular 18](https://angular.dev/)
* [single-spa](https://single-spa.js.org/) >= 4
* [single-spa-angular](https://single-spa.js.org/docs/ecosystem-angular/) 9.2
* [Angular Material 18](https://material.angular.io/)
* [TailwindCSS 3.4](https://tailwindcss.com/)
* [TypeScript 5.5](https://www.typescriptlang.org/)
* [RxJS 7.8](https://rxjs.dev/)

### Arquitectura

El punto de entrada es `src/main.single-spa.ts`, que exporta el ciclo de vida de single-spa (`bootstrap`, `mount`, `unmount`). La compilación usa `@angular-builders/custom-webpack` y `single-spa-angular` para generar un único bundle UMD, `dist/novedades-mf/main.js`, que el cliente contenedor monta en la ruta `/novedades`.

El código sigue una arquitectura por capas (presentación, aplicación, dominio e infraestructura) dentro de un solo dominio, `src/app/domains/contratos/`. El detalle está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), y cada decisión de arquitectura, en [docs/adr/](docs/adr/).

El uso del módulo está en el [manual de usuario](docs/MANUAL_USUARIO.md); la instalación, el despliegue, la integración con el backend y cómo extenderlo, en el [manual técnico](docs/MANUAL_TECNICO.md), y la validación de seguridad previa al despliegue, en [docs/SEGURIDAD.md](docs/SEGURIDAD.md).

### Módulos y Rutas

| Ruta | Pantalla |
| --- | --- |
| `/novedades` | Panel de contratos: búsqueda, estado del contrato, novedades registradas y anulación |
| `/novedades/contratos/:contractId/novedades/adicion-prorroga` | Adición y prórroga |
| `/novedades/contratos/:contractId/novedades/suspension` | Suspensión |
| `/novedades/contratos/:contractId/novedades/reinicio` | Reinicio |
| `/novedades/contratos/:contractId/novedades/cesion` | Cesión |
| `/novedades/contratos/:contractId/novedades/terminacion` | Terminación anticipada |
| `/novedades/contratos/:contractId/novedades/poliza` | Póliza del cesionario tras una cesión |

`:contractId` es `{numero}_{vigencia}`. Las rutas de novedad exigen un rol autorizado y que el estado del contrato admita esa novedad; si no, vuelven al panel.

### Ambientes de Desarrollo

| Ambiente | Archivo | Servidor local | Compilación |
| --- | --- | --- | --- |
| Producción | `src/environments/environment.ts` | — | `pnpm build:prod` |
| Local | `src/environments/environment.development.ts` | `pnpm start` | `pnpm watch` |
| Pruebas | `src/environments/environment.test.ts` | `pnpm start:test` | `pnpm build:test` |

Cada compilación genera `dist/novedades-mf/main.js` con la URL pública (`deployUrl`) de su ambiente, definida en `angular.json`.

## Ejecución del Proyecto

Este proyecto es parte de una infraestructura de microfrontend implementada con la librería Single-SPA. Para ejecutarlo correctamente, es necesario levantar dos aplicaciones independientes: el **Root** y el **Core**.

### Root

El Root contiene la lógica de Argo.

#### Pasos para la Ejecución del Root

1. Clonar el repositorio del Root:

   ```bash
   git clone https://github.com/udistrital/gestion_contractual_root_mf
   ```

2. Acceder al directorio del repositorio clonado:

   ```bash
   cd gestion_contractual_root_mf
   ```

3. Instalar las dependencias:

   ```bash
   pnpm install
   ```

4. Iniciar el Root:
   ```bash
   pnpm start
   ```

### Core

El Core contiene componentes generales que construyen el layout y administran aspectos como la autenticación.

#### Pasos para la Ejecución del Core

1. Clonar el repositorio del Core:

   ```bash
   git clone https://github.com/udistrital/core_mf_cliente
   ```

2. Acceder al directorio del repositorio clonado:

   ```bash
   cd core_mf_cliente
   ```

3. Instalar las dependencias:

   ```bash
   pnpm install
   ```

4. Iniciar el Core:

   ```bash
   pnpm start
   ```

### novedades_mf

Microcliente de gestión de novedades.

#### Pasos para la Ejecución de novedades_mf

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/udistrital/novedades_mf
   ```

2. Acceder al directorio del repositorio clonado:

   ```bash
   cd novedades_mf
   ```

3. Instalar las dependencias:

   ```bash
   pnpm install
   ```

4. Iniciar novedades_mf:

   ```bash
   pnpm start
   ```

Con estos pasos, se tendrán las partes mínimas necesarias para ejecutar el proyecto en un entorno local. El microcliente queda publicado en `http://localhost:4209/main.js`, listo para ser consumido por el Root.

## Ejecución Pruebas

Pruebas unitarias (Karma + Jasmine) y análisis estático:

```bash
pnpm test                                             # abre Chrome y queda observando cambios
pnpm test --watch=false --browsers=ChromeHeadless     # una sola corrida, sin ventana
pnpm lint
```
## Licencia

[This file is part of novedades_mf](LICENSE)

novedades_mf is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

novedades_mf is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with novedades_mf. If not, see https://www.gnu.org/licenses/.
