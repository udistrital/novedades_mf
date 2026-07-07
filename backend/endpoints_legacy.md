# Endpoints y recursos de backend consumidos — novedades_cliente

> Inventario extraído directamente del código (no de documentación externa). Por cada llamada: servicio (factory Angular), método HTTP, endpoint/recurso exacto, qué envía, qué trae/usa, y para qué se usa en el negocio.

## Notas de lectura

- Todas las factories de servicio (`*Request`) siguen el mismo patrón: `$http.<verbo>(CONF.GENERAL.<CONSTANTE> + tabla, ...)`. El endpoint completo a consumir en el nuevo proyecto es **`URL base (tabla 0)` + `Endpoint/recurso` (tablas 1-8)**.
- La base de configuración realmente activa en `index.html` es `app/scripts/environment/environment.js` (no `app/scripts/services/config.js`, que existe pero no está cargado). También existen `environment_prod.js` y `environment_test.js`; las diferencias entre los tres se listan en la columna "Notas" de la tabla 0.
- `agoraRequest` y `amazonAdministrativaRequest` apuntan a la **misma base** (`ADMINISTRATIVA_PRUEBAS_SERVICE`); son wrappers casi idénticos usados indistintamente según el archivo.
- Varias factories genéricas (`oikosAmazonRequest`, `titanRequest`, `homologacionDependenciaService`, `configuracionRequest.put/delete`) están definidas pero **sin ningún consumidor encontrado** en el código actual — se listan al final como referencia de capacidad disponible, no de uso real.

---

## 0. URL base por servicio (host real, tomado de `environment*.js`)

| Factory (Angular) | Constante `CONF.GENERAL` | URL base — `environment.js` (dev, activo) | Notas / diferencias en `environment_prod.js` y `environment_test.js` |
|---|---|---|---|
| agoraRequest, amazonAdministrativaRequest | `ADMINISTRATIVA_PRUEBAS_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_amazon_api/v1/` | Igual en prod y test |
| administrativaRequest | `ADMINISTRATIVA_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_crud_api/v1/` | Igual en prod y test |
| adminMidRequest | `ADMINISTRATIVA_MID_SERVICE` | `http://api.intranetoas.udistrital.edu.co:8091/v1/` | Prod/test usan host distinto: `http://pruebasapi.intranetoas.udistrital.edu.co:8091/v1/` |
| configuracionRequest | `CONFIGURACION_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/configuracion_crud_api/v1/` | Igual en prod y test |
| coreRequest | `CORE_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/core_api/v1/` | Igual en prod; **no está definida en `environment_test.js`** |
| coreAmazonRequest | `CORE_AMAZON_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/core_amazon_crud/v1/` | Igual en prod; **no está definida en `environment_test.js`** |
| financieraMidRequest | `FINANCIERA_MID_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/financiera_mid_api/v1/` | Igual en prod; **no está definida en `environment_test.js`** |
| financieraRequest | `FINANCIERA_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/financiera_crud_api/v1/` | Igual en prod; **no está definida en `environment_test.js`** |
| financieraJbpmRequest | `FINANCIERA_JBPM_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/financiera_jbpm/v1/` | Igual en prod; **no está definida en `environment_test.js`** |
| oikosRequest | `OIKOS_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/oikos_crud_api/v2/` | Igual en prod; **no está definida en `environment_test.js`** |
| argoNosqlRequest | `ARGO_NOSQL_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_crud/v1/` | Solo en `environment.js`; sin consumidor encontrado |
| contratoRequest | `CONTRATO_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/administrativa_jbpm/v2/` | **Prod y test usan `v1/` en vez de `v2/`** — verificar cuál es la versión real antes de migrar |
| novedadesRequest | `NOVEDADES_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_crud/v1/` | Igual en prod y test |
| novedadesMidRequest | `NOVEDADES_MID_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/novedades_mid/v1/` | Igual en prod; en test hay una alterna comentada `localhost:8502/v1/` |
| documentosCrudRequest | `DOCUMENTOS_CRUD` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/documento_crud/v2/` | Igual en prod y test |
| titanMidRequest | `TITAN_MID_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/titan_api_mid/v1/` | Igual en prod y test |
| cumplidosMidRequest | `CUMPLIDOS_MID_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/cumplidos_mid/v1/` | Igual en prod y test |
| homologacionDependenciaService | `HOMOLOGACION_SERVICE` | `https://autenticacion.udistrital.edu.co:8244/dependencias_api/v1/` | Igual en prod y test; sin consumidor |
| nuxeoClient | `NUXEO_SERVICE` | `https://autenticacion.portaloas.udistrital.edu.co/apioas/nuxeo_api/v1/` | Igual en prod; **no está definida en `environment_test.js`**; sin consumidor |
| notificacion (WS) | `NOTIFICACION_WS` | `wss://pruebasapi.portaloas.udistrital.edu.co:8116/ws/join` | Igual en los tres |
| resolucionRequest | `RESOLUCION_SERVICE` | **no definida en ningún `environment*.js`** | `path` queda `undefined` → todo request de `rp_solicitud_personas.js` (sección 4) sale a `undefined/tabla`; hay que fijar el host real antes de migrar esos endpoints |
| titan_request, oikosAmazonRequest, sicapitalRequest, academicaRequest, academicaWsoService | `TITAN_SERVICE`, `OIKOS_AMAZON_SERVICE`, `SICAPITAL_SERVICE`, `ACADEMICA_SERVICE`, `ACADEMICA_WSO_SERVICE` | **ninguna definida en `environment*.js`** | Coincide con "sin consumidores" — si se necesitan a futuro, falta configurar su host |

---

## 1. Endpoints para el nuevo proyecto — Navegación y notificaciones (core)

> Autenticación excluida de este inventario (se define de nuevo en el proyecto nuevo). Lo que sigue son los endpoints de negocio a replicar: recurso exacto, qué se envía y para qué se usa cada uno.

| Servicio (factory) | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| configuracionRequest (comentado/inactivo) | GET | `menu_opcion_padre/ArbolMenus/{roles}/{APP_MENU}` | roles del usuario + constante de app | Árbol de menú lateral dinámico por rol — reemplazado por menú mock hardcodeado | core/menu-lateral/menu-lateral.js |
| configuracionRequest | POST | `aplicacion_rol/aplicacion_rol` | `[{Nombre: rol}, ...]` extraído del JWT | Lista de apps habilitadas por rol para el mosaico "menú de aplicaciones" | core/menu-aplicaciones/menu-aplicaciones.js |
| notificacion (WS) | WS | `NOTIFICACION_WS` (`wss://.../ws/join`) + `?id={access_token}` | access_token como id de conexión | Stream de notificaciones push en tiempo real (badge/panel del header) | core/services/notificacion.js |
| notificacion (WS) | WS send | `"ping"` cada 50s | — | Keepalive del socket | core/services/notificacion.js |
| notificacion (WS) | WS send | `{action:'get'}` | — | Solicitud manual de notificaciones (sin invocación encontrada) | core/services/notificacion.js |
| configuracionRequest (comentado/inactivo) | GET | `notificacion_estado_usuario?query=Usuario:{sub},Activo:true&sortby=notificacion&order=asc&limit=-1` | usuario del token | Listado de notificaciones — reemplazado por el WS | core/services/notificacion.js |
| configuracionRequest | POST | `notificacion_estado_usuario/changeStateNoView/{user}` | `{}`, user=sub del token | Marca todas las notificaciones como vistas al abrir el panel | core/services/notificacion.js |
| configuracionRequest | GET | `notificacion_estado_usuario/changeStateToView/{id}` | id de notificación-estado | Marca una notificación puntual como leída | core/services/notificacion.js |

---

## 2. Módulo Legal — Novedades poscontractuales

| Servicio | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| agoraRequest | GET | `vigencia_contrato` | — | Catálogo de vigencias para el buscador de contrato | legal.js |
| agoraRequest | GET | `contrato_general/?query=ContratoSuscrito.NumeroContratoSuscrito:{n},VigenciaContrato:{v}` | número + vigencia | Datos generales del contrato (valor, objeto, ordenador, contratista, fecha registro) — búsqueda principal | legal.js, y repetido en todas las actas (adición/prórroga, cesión, suspensión, reinicio, terminación) para precargar el formulario |
| agoraRequest | GET | `contrato_estado?query=NumeroContrato:{n},Vigencia:{v}&sortby=Id&order=desc&limit=1` | id contrato + vigencia | Último estado registrado del contrato (habilita/deshabilita acciones) | legal.js, aprobacion.js, y como validación previa en suspensión/reinicio/terminación |
| novedadesMidRequest | GET | `novedad/{numero_contrato}/{vigencia}` | número + vigencia | Historial de novedades del contrato (recalcula valor con adiciones, detecta última novedad/cesionario) | legal.js y todas las actas legales |
| novedadesMidRequest | PATCH | `novedad/{id}` `{usuario:"CC"+documento}` | id de novedad, usuario | Anular la última novedad registrada | legal.js |
| novedadesMidRequest | PATCH | `novedad/{id}` `{Activo:false}` | id de la fila | Anular novedad desde el listado de consulta (prototipo con datos mock) | consulta_novedades.js |
| novedadesMidRequest | GET | `gestor_documental/{enlace}` | enlace/id de documento | PDF en base64 para visualizar el acta generada | legal.js |
| novedadesRequest | GET | `tipo_novedad?query=Id:{id}` | id de tipo | Código abreviado del tipo de novedad (cesión/suspensión/adición/etc.) | legal.js, todas las actas |
| novedadesRequest | GET | `tipo_novedad?query=Nombre:{Adición\|Prórroga\|Adición/Prórroga\|Cesión\|Suspensión\|Reinicio\|Terminación Anticipada}` | nombre exacto del tipo | Código de tipo de novedad para armar el payload al crear cada novedad | acta_adicion_prorroga.js, acta_cesion.js, acta_suspension.js, acta_reinicio.js, acta_terminacion_liquidacion_bilateral.js |
| agoraRequest | GET | `informacion_proveedor?query=Id:{id}` / `?query=NumDocumento:{doc}` | id o documento del proveedor | Datos del contratista/cesionario/cedente (nombre, documento) | legal.js y todas las actas (repetido decenas de veces con distintos actores: contratista, cesionario, supervisor, ordenador, jefe jurídico) |
| agoraRequest | GET | `informacion_persona_natural?query=Id:{id}` | id de persona | Nombre completo, tipo de documento, ciudad de expedición | legal.js y todas las actas (usuario que elabora, contratista, supervisor, ordenador, jefe jurídico, cesionario) |
| coreAmazonRequest | GET | `ciudad?query=Id:{id}` | id de ciudad | Nombre de la ciudad de expedición de documento | todas las actas legales (para cada persona involucrada) |
| agoraRequest | GET | `estado_contrato?query=NombreEstado:{En ejecucion\|Suspendido}` | nombre de estado | Id del estado destino para transiciones (activar/suspender contrato) | legal.js, acta_suspension.js, acta_terminacion_liquidacion_bilateral.js |
| novedadesMidRequest | POST | `validarCambioEstado` | `{Estado, FechaRegistro, NumeroContrato, Usuario, Vigencia}` | Valida si el cambio de estado de la novedad es permitido antes de crearla | legal.js (activar contrato), acta_suspension.js, acta_reinicio.js, acta_terminacion_liquidacion_bilateral.js, aprobacion.js |
| novedadesMidRequest | POST | `novedad` | payload completo de la novedad (contrato, fechas, valores, motivo, tipo, estado) | Crear la novedad (adición, cesión, suspensión, reinicio, terminación) | acta_adicion_prorroga.js, acta_cesion.js, acta_suspension.js, acta_reinicio.js, acta_terminacion_liquidacion_bilateral.js, aprobacion.js |
| novedadesMidRequest | POST | `replica` | contrato, vigencia, contratista, documento, fechas, plazo/valor, unidad, tipo novedad, CDP | Replicar la novedad en el sistema legado (Ágora) — si falla, se compensa desactivando la novedad recién creada | todas las actas legales, aprobacion.js |
| novedadesMidRequest | PUT | `replica/{id}` | fechas, contratista, plazo, unidad, tipo novedad | Actualizar la réplica en el flujo de reinicio | acta_reinicio.js |
| novedadesRequest | GET | `novedades_poscontractuales/{id}` | id de novedad | Recuperar la novedad para poder desactivarla si la réplica falló | todas las actas legales (paso de compensación) |
| novedadesRequest | PUT | `novedades_poscontractuales/{id}` | copia con `Activo:false, Motivo:"Error en la réplica"` | Desactivar la novedad cuando la réplica falla (rollback manual) | todas las actas legales |
| novedadesMidRequest | PUT | `novedad/{id}` | objeto de novedad actualizado | Actualizar una novedad de adición existente (edición) | acta_adicion_prorroga.js |
| agoraRequest / amazonAdministrativaRequest | POST | `contrato_estado` | `{Estado.Id, NumeroContrato, Usuario, Vigencia, FechaRegistro}` | Registrar el nuevo estado del contrato (Suspendido=2, En ejecución=4, Terminado=8) tras aprobar la novedad | acta_suspension.js, acta_reinicio.js, acta_terminacion_liquidacion_bilateral.js, aprobacion.js |
| agoraRequest / amazonAdministrativaRequest | GET | `acta_inicio?query=NumeroContrato:{id}` | id de contrato | Fechas de inicio/fin del contrato para calcular límites y fecha fin efectiva | acta_adicion_prorroga.js, acta_cesion.js, acta_reinicio.js, acta_suspension.js, acta_terminacion_liquidacion_bilateral.js |
| agoraRequest | GET | `contrato_suscrito?query=NumeroContratoSuscrito:{n},Vigencia:{v}` | número + vigencia | Id interno del contrato suscrito (para localizar acta de inicio / resolver ordenador) | acta_adicion_prorroga.js |
| agoraRequest / amazonAdministrativaRequest | GET | `ordenadores?query=IdOrdenador:{id},FechaInicio__lte:{f},FechaFin__gte:{f}` | id ordenador + fecha | Rol del ordenador vigente en una fecha dada | acta_adicion_prorroga.js, acta_cesion.js, acta_suspension.js, acta_terminacion_liquidacion_bilateral.js |
| agoraRequest / amazonAdministrativaRequest | GET | `ordenadores?query=RolId:{rol}&sortby=FechaInicio&order=desc&limit=1` | rolId | Datos del ordenador del gasto actual para ese rol | ídem anteriores |
| agoraRequest / amazonAdministrativaRequest | GET | `supervisor_contrato?query=DependenciaSupervisor:{dep}&sortby=FechaInicio\|FechaFin&order=desc&limit=1` | dependencia (fija `DEP636` para jurídica, o la del contrato) | Documento del supervisor del contrato o del jefe de la Oficina Jurídica | todas las actas legales |
| financieraJbpmRequest | GET | `cdp_vigencia/{vigencia}/{contrato_id}` | vigencia + contrato | Número de solicitud del CDP vigente | acta_cesion.js, acta_reinicio.js, acta_suspension.js, acta_terminacion_liquidacion_bilateral.js |
| financieraJbpmRequest | GET | `cdprptercerocontrato/{vigencia}/{contrato_id}[/{unidad}/12]` | vigencia, contrato, unidad ejecutora | CDP y RP vigente del contrato para el encabezado del acta | acta_cesion.js, acta_suspension.js, acta_terminacion_liquidacion_bilateral.js |
| amazonAdministrativaRequest | GET | `novedad_postcontractual?query=numero_contrato:{n},vigencia:{v},TipoNovedad:216&limit=0&sortby=FechaRegistro&order=desc` | número, vigencia, tipo=216 (suspensión) | Recuperar la suspensión previa que se va a reiniciar | acta_reinicio.js |
| agoraRequest | GET | `informacion_proveedor?fields=...&limit=0` | selección de campos | Listado completo de personas naturales para buscador de cesionario | acta_cesion.js |
| coreAmazonRequest | GET | `entidad_aseguradora?limit=0` | — | Catálogo de aseguradoras para registrar póliza | acta_inicio.js |
| novedadesRequest | GET | `poliza?query=IdNovedadesPoscontractuales:{id}` | id de última novedad | Póliza existente asociada al contrato | acta_inicio.js |
| novedadesRequest | PUT | `poliza/{id}` | EntidadAseguradoraId, NumeroPolizaId | Registrar/actualizar la póliza (paso posterior a una cesión) | acta_inicio.js |

---

## 3. Seguimiento Financiero y Aprobación

| Servicio | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| amazonAdministrativaRequest | GET | `vigencia_contrato` | — | Vigencias disponibles | financiero.js |
| amazonAdministrativaRequest | GET | `proveedor_contrato_persona/{vigencia}` | vigencia | Contratistas/contratos de esa vigencia (grid principal) | financiero.js, rp_solicitud_personas.js |
| agoraRequest | GET | `informacion_proveedor?query=NumDocumento:{doc}` | documento del usuario logueado | Id de proveedor asociado (autocompletar cuando el rol es Contratista) | aprobacion.js, legal.js |
| agoraRequest | GET | `contrato_general?query=Contratista:{id}` | id de proveedor | Contrato(s) asociados, autocarga para el usuario Contratista | aprobacion.js, legal.js |
| novedadesMidRequest | GET | `aprobacion/{rolActual}` | rol activo del usuario | Listado de novedades pendientes de aprobación (numContrato, vigencia, tipo, fecha, estado) | aprobacion.js |
| novedadesMidRequest | POST | `validarCambioEstado`, `replica`, `novedad` | (ver sección Legal) | Flujo de aprobación de suspensión desde la bandeja de aprobación — **código con variables indefinidas, no confiable como fuente de regla de negocio** | aprobacion.js |

---

## 4. Registro Presupuestal (RP)

| Servicio | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| adminMidRequest | GET | `contrato_general/ListaContratoContratoSuscrito/{vigencia}` | `limit, offset, query` (paginación server-side) | Grid de contratos cuando el origen del RP es "por Contrato" | rp_solicitud_personas.js |
| financieraMidRequest | GET | `disponibilidad/ListaDisponibilidades/{vigencia}` | `limit, offset, query` excluyendo `Estado.Nombre:Agotado` | Grid de CDPs vigentes cuando el origen es "por CDP" | rp_solicitud_personas.js, rp_solicitud.js |
| resolucionRequest | GET | `resolucion_estado/` | `query=Resolucion.Vigencia:{v},Estado.Id:2` | Grid de resoluciones vigentes/aprobadas cuando el origen es "por Resolución" | rp_solicitud_personas.js |
| resolucionRequest | GET | `vinculacion_docente` | `query=IdResolucion.Id:{id},Estado:true` | Docentes vinculados activos a una resolución | rp_solicitud_personas.js |
| amazonAdministrativaRequest | GET | `proveedor_contrato_persona/{numContrato}/{vigencia}` | número + vigencia | Contrato asociado a cada docente vinculado | rp_solicitud_personas.js |
| amazonAdministrativaRequest | GET | `contrato_disponibilidad?query=NumeroContrato:{n},Vigencia:{v}` | número + vigencia | CDP(s) asociados al contrato | rp_solicitud_personas.js, rp_solicitud.js |
| financieraRequest | GET | `disponibilidad?query=NumeroDisponibilidad:{n},Vigencia:{v}` | número CDP + vigencia | Detalle completo de la disponibilidad/CDP | rp_solicitud_personas.js |
| financieraRequest | GET | `disponibilidad_apropiacion` | `limit=-1&query=Disponibilidad.Id:{id}` | Rubros/apropiaciones del CDP seleccionado | rp_solicitud.js, lista_cdp.js |
| financieraRequest | POST | `disponibilidad/SaldoCdp` | `{Disponibilidad, Apropiacion}` | **Saldo disponible del rubro** — cálculo central reutilizado en RP y en el grid de CDPs, siempre resuelto en backend | rp_solicitud.js, lista_cdp.js |
| amazonAdministrativaRequest | GET | `informacion_proveedor` | `limit=-1` | Lista de proveedores para elegir destinatario del RP (origen CDP) | rp_solicitud.js |
| administrativaRequest | GET | `solicitud_disponibilidad?query=Id:{cdpId}` | id de CDP | Necesidad/justificación origen del CDP | rp_solicitud.js, lista_cdp.js |
| amazonAdministrativaRequest | GET | `informacion_persona_natural?query=Id:{id}` | id de responsable | Datos del responsable del CDP | rp_solicitud.js |
| coreRequest | GET | `jefe_dependencia/{id}` | id fijo (18) | Jefe de dependencia solicitante | rp_solicitud.js |
| financieraRequest | GET | `compromiso` | `limit=-1&query=Vigencia__in:{año},{año-1}` | Catálogo de compromisos presupuestales | rp_solicitud.js |
| administrativaRequest | POST | `solicitud_rp/AddSolicitudRpTr` | array de solicitudes (`rubros[]` + `solicitudRp`) | **Registro transaccional del RP** (soporta lote/masivo con éxito parcial) | rp_solicitud.js |
| administrativaRequest | POST | `disponibilidad_apropiacion_solicitud_rp` | `{DisponibilidadApropiacion, Monto}` | Registro individual rubro-monto (camino alterno/legado) | rp_solicitud.js |
| amazonAdministrativaRequest | POST | `resolucion_estado` | `{FechaRegistro, Usuario, Estado:{Id:4}, Resolucion}` | Marca la resolución como procesada tras registrar el RP (origen Resolución) | rp_solicitud.js |

---

## 5. Directivas de apoyo presupuestal (usadas por RP, Financiero y Seguimiento)

| Servicio | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| financieraRequest | GET | `fuente_financiamiento_apropiacion` | `query=Apropiacion:{ap},Dependencia:{dep}` | Fuentes de financiamiento de una apropiación | fuentes_apropiacion.js |
| financieraRequest | GET | `apropiacion` | `limit=-1&query=Vigencia:{v},Rubro.Codigo__startswith:{tipo},Rubro.UnidadEjecutora:{ue},Estado.Id:2` | Árbol jerárquico de rubros presupuestales activos | lista_apropiaciones.js |
| financieraRequest | GET | `producto_rubro` | `query=Rubro.Id:{id},Activo:true` | Productos asociados a un rubro | productos_apropiacion.js |
| financieraRequest | GET | `solicitud_avance/{procesoExterno}` | id de proceso externo | Objetivo/nombre descriptivo del avance | lista_avances.js |
| administrativaRequest | GET | `necesidad_proceso_externo` | `limit, offset, query` con `Necesidad__isnull:true` | Grid paginado de procesos externos disponibles (sin necesidad asociada) | lista_avances.js |
| financieraRequest | GET | `disponibilidad` | `limit=-1` | Listado completo de CDPs | lista_cdp.js |
| financieraMidRequest | GET | `disponibilidad/SolicitudById/{id}` | id de solicitud | Solicitud origen de cada CDP | lista_cdp.js |
| coreRequest | GET | `actividad_economica` | `query=ClasificacionCiiu.Nombre:Subclase,Activo:true` | Catálogo CIIU (solo nivel subclase) | lista_actividades_economicas.js |
| administrativaRequest | GET | `catalogo_elemento_grupo` | `fields, limit=-1, sortby` | Subgrupos/elementos de catálogo | lista_subgrupos_catalogos.js |

---

## 6. Plantillas y Reportes

| Servicio | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| administrativaRequest | GET | `tipo_contrato` | `query=Estado:true` | Tipos de contrato activos (único dato real; el resto de Plantillas es mock) | generacion_plantilla.js |
| SpagoBI SDK | POST | `https://intelligentia.udistrital.edu.co:8443/SpagoBI/servlet/AdapterHTTP` | **credenciales hardcodeadas** `sergio_orjuela/sergio_orjuela` | Autenticación contra el motor de reportes | reportes_spagobi.js |
| SpagoBI SDK | GET | mismo host, `documentLabel` + `PARAMETERS` (id_resolucion+vigencia, o id_dependencia+vigencia+numero_elaboracion) | parámetros de contexto | HTML embebido del reporte (iframe) | reportes_spagobi.js |

---

## 7. Módulo Necesidad (servicio compartido)

| Servicio | Método | Endpoint/recurso | Qué envía | Qué trae / para qué se usa | Archivo |
|---|---|---|---|---|---|
| administrativaRequest | GET | `estado_necesidad` | — | Catálogo de estados de necesidad (Solicitada, Aprobada, Rechazada, Anulada, Modificada, Enviada, CdpSolicitado) | necesidad_service.js |
| coreRequest → agoraRequest | GET | `jefe_dependencia` → `informacion_persona_natural` | Id/DependenciaId + fecha vigente | Jefe de dependencia vigente y sus datos | necesidad_service.js, visualizar_necesidad.js |
| oikosRequest | GET | `dependencia` | `limit=-1, sortby=Nombre` | Catálogo completo de dependencias | necesidad_service.js, visualizar_necesidad.js |
| financieraRequest | GET | `apropiacion`, `fuente_financiamiento_apropiacion`, `fuente_financiamiento` | Ids de apropiación/fuente/dependencia | Detalle de apropiaciones y fuentes de financiación de una necesidad | necesidad_service.js |
| agoraRequest | GET | `parametro_estandar?query=ClaseParametro:Tipo Perfil` | — | Catálogo de perfiles estándar | necesidad_service.js |
| administrativaRequest | GET | `necesidad`, `detalle_servicio_necesidad`, `actividad_especifica`, `actividad_economica_necesidad`, `marco_legal_necesidad`, `dependencia_necesidad`, `necesidad_rechazada` | Id de necesidad | Carga completa de una necesidad existente (edición/visualización) | necesidad_service.js, visualizar_necesidad.js |
| adminMidRequest | GET | `solicitud_necesidad/fuente_apropiacion_necesidad/{id}` | Id de necesidad | Fuentes de apropiación ya asociadas | necesidad_service.js, visualizar_necesidad.js |
| administrativaRequest | GET | `solicitud_disponibilidad?query=Necesidad:{id}` | Id de necesidad | CDP ligado a la necesidad | visualizar_necesidad.js |
| administrativaRequest | GET | `marco_legal` | `limit=0` | Catálogo completo de marco legal | lista_documentos_legales.js |

---

## 8. Servicios de dominio genéricos (CRUD `get/post/put/delete` sobre una tabla)

| Servicio | Base | Usado por | Estado |
|---|---|---|---|
| documentosCrudRequest | `DOCUMENTOS_CRUD` | aprobacion.js, legal.js | En uso (metadatos de documentos) |
| oikosRequest | `OIKOS_SERVICE` | necesidad_service.js, visualizar_necesidad.js (`dependencia`) | En uso |
| titanMidRequest | `TITAN_MID_SERVICE` | acta_adicion_prorroga.js, acta_cesion.js, acta_suspension.js | Inyectado, sin uso evidente en el flujo leído |
| cumplidosMidRequest | `CUMPLIDOS_MID_SERVICE` | acta_adicion_prorroga.js, acta_terminacion_liquidacion_bilateral.js | Inyectado, sin uso evidente |
| contratoRequest | `CONTRATO_SERVICE` | rp_solicitud_personas.js, acta_cesion.js, acta_reinicio.js | Inyectado; `get/post` no envían header Bearer (posible bug) |
| adminMidRequest | `ADMINISTRATIVA_MID_SERVICE` | necesidad_service.js, visualizar_necesidad.js | En uso |
| oikosAmazonRequest | `OIKOS_AMAZON_SERVICE` | — | **Sin consumidores encontrados** |
| titanRequest | `TITAN_SERVICE` | — | **Sin consumidores encontrados** |
| homologacionDependenciaService | `HOMOLOGACION_SERVICE` | — | **Sin consumidores encontrados** |
| configuracionRequest (put/delete) | `CONFIGURACION_SERVICE` | — | Definido, **sin consumidores** |
| nuxeoClient (SDK Nuxeo) | `NUXEO_SERVICE` | — | Cliente completo (crear/leer documentos) definido, **sin consumidores encontrados** |

---

## Hallazgos relevantes para la migración

1. **Cálculo de saldo presupuestal centralizado en backend** (`disponibilidad/SaldoCdp`) — no reimplementar en el nuevo frontend, es la única fuente de verdad.
2. **Patrón "crear + replicar + compensar"** repetido en todas las novedades legales (`novedad` → `replica` → si falla, `PUT novedades_poscontractuales` con `Activo:false`) — no es una transacción real; candidato a resolverse con una transacción/saga en la nueva arquitectura.
3. **Credenciales hardcodeadas** en la integración con SpagoBI — deben moverse a backend.
4. Varios servicios de dominio (Titan, Oikos Amazon, Homologación) están definidos pero sin consumidor real — confirmar con negocio si son integraciones pendientes o deuda muerta antes de migrarlos.
5. **`RESOLUCION_SERVICE` no existe en ningún `environment*.js`** — `resolucionRequest` (usado en `rp_solicitud_personas.js`, sección 4) resuelve su URL base a `undefined`; hay que averiguar el host real con el equipo backend antes de migrar el módulo de RP por Resolución.
6. **`CONTRATO_SERVICE` apunta a `v2/` en `environment.js` (dev) pero a `v1/` en prod y test** — confirmar cuál versión de `administrativa_jbpm` es la correcta antes de fijarla en el nuevo proyecto.
