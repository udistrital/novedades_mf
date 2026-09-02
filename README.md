# novedades_mf

Microcliente para la gestión, registro, actualización y consulta de novedades poscontractuales de la Universidad Distrital Francisco José de Caldas. Forma parte de la arquitectura de microfrontends del sistema de gestión contractual y se integra en el cliente contenedor mediante [single-spa](https://single-spa.js.org/).

## Especificaciones Técnicas

### Tecnologías Implementadas y Versiones

* [Angular 18](https://angular.dev/) (standalone components, signals, zoneless)
* [single-spa](https://single-spa.js.org/) >= 4
* [single-spa-angular](https://single-spa.js.org/docs/ecosystem-angular/) 9.2
* [Angular Material 18](https://material.angular.io/)
* [TailwindCSS 3.4](https://tailwindcss.com/)
* [TypeScript 5.5](https://www.typescriptlang.org/)
* [RxJS 7.8](https://rxjs.dev/)

### Variables de Entorno

La configuración por ambiente vive en `src/environments/`:

| Variable | Descripción |
| --- | --- |
| `ADMINISTRATIVA_PRUEBAS_SERVICE` | API `administrativa_amazon_api` — contratos generales y proveedores |
| `NOVEDADES_MID_SERVICE` | API `novedades_mid` — novedades por contrato |
| `NOVEDADES_SERVICE` | API `novedades_crud` — persistencia de novedades (fase de escrituras) |
| `CORE_AMAZON_SERVICE` | API `core_amazon_crud` — catálogo de entidades aseguradoras |
| `FINANCIERA_JBPM_SERVICE` | API `financiera_jbpm` — CDP y CRP vigentes que imprime el acta |
| `ACTAS_MID_SERVICE` | `actas_novedad_mid` — generación del PDF del acta (**servicio temporal**) |
| `TOKEN` | Configuración OAuth2 de WSO2 (client id, redirect, scopes, logout) |

| Ambiente | Archivo | Compilación |
| --- | --- | --- |
| Producción | `src/environments/environment.ts` | `npm run build` |
| Local | `src/environments/environment.development.ts` | `npm start` |
| Pruebas | `src/environments/environment.test.ts` | `npm run start:test` |

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
   npm install
   ```

4. Iniciar el Root:
   ```bash
   npm start
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
   npm install
   ```

4. Iniciar el Core:

   ```bash
   npm start
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
   npm install
   ```

4. Iniciar novedades_mf:

   ```bash
   npm start
   ```

Con estos pasos, se tendrán las partes mínimas necesarias para ejecutar el proyecto en un entorno local. El microcliente queda publicado en `http://localhost:4209/main.js`, listo para ser consumido por el Root.

## Ejecución Dockerfile

```bash
# Does not apply
```

## Ejecución docker-compose

```bash
# Does not apply
```

## Ejecución Pruebas

Pruebas unitarias (Karma + Jasmine) y análisis estático:

```bash
npm test
npm run lint
```

## Estado CI

```bash
# Pendiente de configuración del pipeline
```

## Licencia

[This file is part of novedades_mf](LICENSE)

novedades_mf is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

novedades_mf is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with novedades_mf. If not, see https://www.gnu.org/licenses/.
