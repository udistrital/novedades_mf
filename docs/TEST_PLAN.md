# Plan de pruebas — novedades_mf

Plan de pruebas manual, funcionalidad por funcionalidad, para validar el microfrontend tras la ejecución del plan de migración (2026-07-07). Complementa (no reemplaza) las pruebas unitarias automáticas (`npm test`, 31 casos: reglas de dominio y utilidades de formato).

## Precondiciones y ambientes

- **Ambiente recomendado**: integrado con el shell (`gestion_contractual_root_mf` en `localhost:4200`, MF en `localhost:4209` vía `npm start` en ambos repos) y sesión OAuth2 iniciada. Las peticiones a `novedades_mid` pueden responder **403 (900908 Resource forbidden)** desde `localhost` por la restricción de origen del gateway WSO2 — los casos que dependen del mid (historial de novedades, escrituras) deben validarse desde el dominio de pruebas (`pruebasnovedades.portaloas.udistrital.edu.co`) o vía import-map-override sobre él.
- **Datos**: se requieren contratos reales del ambiente de pruebas. Anota en cada caso el par número/vigencia usado.
- **Modo mock** (sin backend): cambiar el binding a `MockContractService` en `app.config.ts` permite validar toda la UX de formularios/validaciones sin red (los casos marcados 🔌 requieren backend real).
- Los resultados se registran como ✅ pasa / ❌ falla / ⚠️ bloqueado, con evidencia (captura o respuesta de red).

## 1. Búsqueda y listado (dashboard)

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| BUS-01 | Estado inicial | Entrar a la vista principal | No hay resultados ni mensaje "No se encontraron…"; el área de resultados está vacía |
| BUS-02 | Búsqueda sin término | Clic en "Buscar Contratos" con el campo vacío | Mensaje "Ingresa un número de contrato o contratista para buscar."; no se dispara petición |
| BUS-03 | Búsqueda por número exacta 🔌 | Seleccionar "Contrato", digitar un número existente, buscar | Aparece el contrato; un número parcial NO trae resultados |
| BUS-04 | Búsqueda por contratista 🔌 | Seleccionar "Contratista", digitar ≥3 dígitos de un documento | El autocomplete lista cédula+nombre en vivo; al buscar traen sus contratos |
| BUS-05 | Criterios excluyentes | Alternar entre "Contrato" y "Contratista" | El término anterior se limpia; nunca se buscan ambos a la vez |
| BUS-06 | Filtro de vigencia 🔌 | Buscar con vigencia específica y con "Todos" | Con vigencia solo trae esa; "Todos" trae todas las vigencias del criterio |
| BUS-07 | Orden por vigencia 🔌 | Buscar un contratista con contratos en varias vigencias | Orden descendente por `VigenciaContrato` (más reciente arriba) |
| BUS-08 | Sin resultados | Buscar un número inexistente | Tarjeta "No se encontraron contratos con los filtros aplicados." |
| BUS-09 | Detalle del contrato 🔌 | Expandir una tarjeta | Se ven contratante, objeto, NIT/CC, **Vigencia** (`VigenciaContrato`), **Estado del Contrato** y, si hay adiciones históricas, "Valor Vigente (con adiciones)" |

## 2. Estado del contrato → acciones disponibles 🔌

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| EST-01 | En ejecución | Expandir contrato con estado "En ejecución" | Menú "Añadir Novedad" con: Adición y Prórroga, Suspensión, Cesión, Terminación Anticipada |
| EST-02 | Suspendido | Contrato con estado "Suspendido" (o última novedad = Suspensión si no hay registro de estado) | Única opción del menú: Reinicio |
| EST-03 | Cesión pendiente de póliza | Contrato en ese estado | Única opción: **Agregar Póliza** (navega a la vista de póliza) |
| EST-04 | Finalizado | Contrato Finalizado | Única opción: **Activar Contrato** (abre modal de confirmación, no navega) |
| EST-05 | Cancelado / Inicio / Terminado | Contrato en cualquiera de esos estados | El botón "Añadir Novedad" NO aparece (solo consulta) |
| EST-06 | Novedad en trámite | Contrato cuya última novedad está "En trámite" | En lugar del botón: aviso "Hay una novedad en trámite: no se pueden crear nuevas novedades." |
| EST-07 | Sin registro de estado | Contrato sin filas en `contrato_estado` | Se comporta por inferencia: suspendido si la última novedad es Suspensión; si no, como En ejecución |

## 3. Validaciones transversales de los formularios

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| VAL-01 | Números negativos | Intentar digitar `-` en cualquier campo numérico | El signo no se puede escribir (ni pegar) |
| VAL-02 | Obligatorios con asterisco | Enviar con un campo obligatorio vacío | No abre el modal; el campo muestra "Este campo es obligatorio." y la vista se desplaza/enfoca al primero inválido |
| VAL-03 | Cláusula adicional | Activar "Agregar Cláusula Adicional" y dejar posición/texto vacíos | Ambos pasan a obligatorios; al desactivar, dejan de serlo |
| VAL-04 | Fechas por defecto | Abrir cualquier formulario | Todas las fechas inician en la fecha actual (salvo derivadas) |
| VAL-05 | Carga al crear | Confirmar en el modal | Botones deshabilitados + spinner mientras responde |
| VAL-06 | Switch de prueba | Activar "simular falla" en el modal y confirmar | Pantalla de error tras el spinner; sin el switch, flujo normal |

## 4. Adición y Prórroga

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| ADI-01 | Ambas secciones obligatorias | Enviar sin Valor Adicional o sin Tiempo de prórroga | No abre el modal; el campo vacío marca "Este campo es obligatorio." (no hay toggles: las dos secciones son fijas) |
| ADI-03 | Tope de adición (50 %) | Digitar un valor > 50 % del valor vigente | Error "Supera el tope legal: máximo 50 % del valor vigente (…)"; bloquea el envío |
| ADI-04 | Tope de prórroga (50 %) | Digitar días > 50 % del plazo vigente en días | Error con el máximo en días; bloquea el envío |
| ADI-05 | Nuevo valor acumulado 🔌 | Contrato con adiciones históricas | "Nuevo Valor del Contrato" = valor vigente (base+históricas) + valor digitado, en número y letras |
| ADI-06 | Nuevo plazo | Digitar días de prórroga | "Nuevo Plazo" = plazo inicial + prórrogas históricas + días nuevos, formato "N ( n ) MESES [Y D ( d ) DÍAS]" (mes = 30 días) |
| ADI-07 | Valor en letras | Digitar 33838900 | "TREINTA Y TRES MILLONES OCHOCIENTOS TREINTA Y OCHO MIL NOVECIENTOS PESOS" |
| ADI-08 | Resumen completo | Abrir el modal de confirmación | El resumen incluye Nuevo Valor y Nuevo Plazo |

## 5. Suspensión

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| SUS-01 | Fecha inicio mínima | Abrir la vista | Fecha inicio por defecto y mínima = inicio del contrato + 1 día |
| SUS-02 | Rango de fechas | Poner fin ≤ inicio | Error de rango en ambos campos; el mínimo del fin es inicio + 1 día |
| SUS-03 | Período derivado | Elegir inicio y fin válidos | "Período suspensión" (no editable) = días entre ambas; "Fecha reinicio" = fin + 1 día |
| SUS-04 | Motivo obligatorio y límite | Dejar vacío / intentar >249 caracteres | Obligatorio; el textarea corta en 249 y valida `maxlength` |

## 6. Reinicio

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| REI-01 | Precarga de la suspensión 🔌 | Entrar desde un contrato suspendido | "Fecha inicio suspensión" (solo lectura) = fecha efectiva de la suspensión vigente |
| REI-02 | Derivadas | Cambiar "Fecha fin suspensión" | Período (no editable) y "Fecha reinicio" = fin + 1 día se recalculan |

## 7. Cesión

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| CES-01 | Cesionario obligatorio y real | Digitar un documento sin elegir opción de la lista | Error "Selecciona una opción de la lista."; solo la selección real habilita crear |
| CES-02 | Solo personas naturales | Digitar el NIT de una persona jurídica | No aparece en las opciones del autocomplete |
| CES-03 | Tarjeta del cesionario | Antes y después de seleccionar | Antes: tarjeta visible con campos "—"; después: datos reales |
| CES-04 | Terminación del cedente | Cambiar la fecha de cesión | "Fecha de terminación del cedente" (no editable) = cesión − 1 día |
| CES-05 | Topes de valores | Digitar desembolsado o favor-cedente > valor vigente | Error "El valor no puede superar el valor vigente del contrato." |
| CES-06 | Saldo del cesionario | Digitar ambos valores | "Saldo restante para el Cesionario" = vigente − (favor cedente + desembolsado); en rojo si es negativo; aparece en el resumen del modal |
| CES-07 | Considerando adicional | Activar el toggle | Posición (1-7) y texto pasan a obligatorios |

## 8. Terminación Anticipada

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| TER-01 | Topes | Digitar cualquiera de los 3 valores > valor vigente | Error de tope; bloquea el envío |
| TER-02 | Saldos excluyentes | Digitar saldo a favor del contratista > 0 | "Saldo a favor de la Universidad" pasa a 0 y se bloquea; al volver a 0 el del contratista, se desbloquea |
| TER-03 | Símbolo de moneda | Revisar los 3 campos de valores | Todos muestran el símbolo $ |

## 9. Registro de Póliza (post-cesión) 🔌

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| POL-01 | Acceso | Contrato en "Cesión pendiente de póliza" → "Agregar Póliza" | Abre `/contratos/{id}/novedades/poliza` con la tarjeta del contrato |
| POL-02 | Catálogo | Abrir el selector de aseguradora | Lista del catálogo `entidad_aseguradora` |
| POL-03 | Precarga | Póliza ya parcialmente registrada | Aseguradora/número precargados (el PUT actualiza, no duplica) |
| POL-04 | Registro | Completar y confirmar | Modal con resumen → éxito; en el backend la fila `poliza` de la novedad queda con `EntidadAseguradoraId`/`NumeroPolizaId` |

## 10. Anulación y Activación 🔌

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| ANU-01 | Solo la última | Ver el historial de un contrato con varias novedades | "Anular" habilitado solo en la última (por fecha) |
| ANU-02 | Tipo ↔ estado | Contrato Suspendido: última novedad = Suspensión | Anulable; la misma novedad con contrato Cancelado NO |
| ANU-03 | Flujo de anulación | Confirmar la anulación | PATCH al mid; pantalla de éxito; al volver, el listado se recarga y la novedad ya no está activa (el backend revierte el estado) |
| ANU-04 | Activar contrato | Contrato Finalizado → Activar Contrato → confirmar | Modal → éxito; al re-consultar, el contrato queda "En ejecución" |

## 11. Control de acceso por rol 🔌

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| ROL-01 | Supervisor propio | Sesión con rol único SUPERVISOR y documento = supervisor del contrato | Ve y usa todas las acciones |
| ROL-02 | Supervisor ajeno | Mismo rol, contrato de otro supervisor | Sin "Añadir Novedad" ni "Anular" (solo consulta); si navega directo a una URL de creación, redirige al dashboard |
| ROL-03 | Otros roles | Sesión con ORDENADOR_DEL_GASTO o ASISTENTE_JURIDICA | Sin restricción por documento |

## 12. Escrituras contra el backend 🔌 (requiere origen autorizado)

| ID | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| ESC-01 | Crear cada tipo | Crear una novedad de cada tipo (adición sola, prórroga sola, ambas, suspensión, cesión, reinicio, terminación) | `POST {mid}novedad/` con `tiponovedad` NP_ADI/NP_PRO/NP_ADPRO/NP_SUS/NP_CES/NP_REI/NP_TER; para SUS/REI/TER antes `POST validarCambioEstado/` y después `POST contrato_estado` (2/4/8). ⚠️ Si el mid rechaza el body (400), el ajuste es solo en `novelty-payload.mapper.ts` — registrar la respuesta para corregir los nombres de campo |
| ESC-02 | Error de negocio | Forzar un rechazo (p. ej. transición inválida) | El mid responde 200 con `Type:"ERROR"` → la UI muestra la pantalla de error (no falso éxito) |
| ESC-03 | Persistencia | Tras crear, volver y re-consultar el contrato | La novedad aparece en el historial |

## Limitaciones conocidas al probar

1. **403 desde localhost** hacia `novedades_mid` (restricción de origen del gateway): probar integrado desde el dominio de pruebas.
2. Los **nombres de campo** del POST de novedades y de las respuestas `GetNovedad*` son aproximaciones documentadas — ESC-01 y ADI-05 sirven precisamente para capturarlos y corregirlos (un archivo cada uno).
3. La **réplica hacia Ágora/Titan no se ejecuta** (TD-007, decisión de backend): no validar preliquidación aquí.
4. Generación/previsualización de **actas** está fuera de esta fase.
