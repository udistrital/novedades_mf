# Revisión de cambios — Ejecución del plan de migración (2026-07-07)

Detalle, tarea por tarea, de la implementación del backlog de [`MIGRATION_PLAN.md`](../info/MIGRATION_PLAN.md) para su revisión. **Exclusiones acordadas**: generación/previsualización de actas (PDF) y el módulo de Aprobación (MIG-014, bloqueado por validación de negocio). Verificación: `ng build` development y production en verde; `npm test` 31/31; `npm run lint` no ejecutable por un problema **preexistente** de dependencias del eslint (`@eslint/js`/`@angular-eslint/builder` sin instalar — pendiente `npm install` de esas devDependencies, no relacionado con estos cambios).

## Resumen ejecutivo

| Tarea | Estado | Nota clave |
|---|---|---|
| MIG-001 Escrituras reales | ✅ | Sin réplica/compensación en cliente ([ADR-014](adr/ADR-014-escrituras-reales-sin-replica.md)); payload por tipo = aproximación corregible en 1 archivo |
| MIG-002 Estado real + mapa estado→acciones | ✅ | Lectura de `contrato_estado` con fallback inferido |
| MIG-003 Bloqueo por novedad en trámite | ✅ | `ENTR` mapeado; aviso en el acordeón |
| MIG-004 Valor/plazo vigentes acumulados | ✅ | Extracción tolerante de valores del mid (nombres por confirmar) |
| MIG-005 Topes 50 % + modos adición/prórroga | ✅ (parcial por requerimiento actualizado) | Topes implementados; los modos opcionales se revirtieron el 2026-07-08: ambas secciones son obligatorias de nuevo |
| MIG-006 Topes y saldo en Cesión | ✅ | Saldo visible + en el resumen; autocomplete solo personas naturales |
| MIG-007 Reglas de Terminación | ✅ | Topes + saldos mutuamente excluyentes |
| MIG-008 Registro de póliza | ✅ | Página nueva `poliza`; PUT sobre el registro de la cesión |
| MIG-009 Anulación estricta | ✅ | Tipo ↔ estado; la reversión la hace el mid |
| MIG-010 Control por rol | ✅ | JWT en cliente + regla de dominio + guard |
| MIG-011 Motivo ≤ 249 | ✅ | Validador + `maxlength` |
| MIG-012 Contratista vigente tras cesión | ✅ | Último cesionario resuelto contra `informacion_proveedor` |
| MIG-013 Normalización de fechas | ✅ Decisión | No se replica el hack ([ADR-013](adr/ADR-013-normalizacion-fechas-legado.md)) + pruebas de borde |
| MIG-014 Aprobación | ⛔ Excluida | Bloqueada por negocio (según plan) |

## Cambios por capa

### Dominio (`src/app/domains/contratos/domain/`)

- **`models/contract-status.enum.ts` (nuevo)**: `ContractStatus` (Inicio, En ejecución, Suspendido, Cesión pendiente de póliza, Finalizado, Cancelado, Terminado) y `ContractAction` (las 4 novedades + Reinicio + Agregar póliza + Activar contrato).
- **`models/contract.entity.ts`**: `Contract` gana `supervisorDocument` (regla de rol) y `status?` (opcional: sin registro en backend ⇒ inferencia). `NoveltySummary` gana `valorAdicion?`, `diasProrroga?`, `cesionarioDocumento?` (alimentan acumulados y contratista vigente).
- **`models/novelty-draft.model.ts`**: `AdicionProrrogaDraft` recupera `activa` en `adicion` y `prorroga` como discriminador del tipo enviado al backend (NP_ADI/NP_PRO/NP_ADPRO). **Requerimiento actualizado (2026-07-08)**: ambas secciones vuelven a ser obligatorias — la página envía siempre `activa: true` en las dos (⇒ NP_ADPRO) y la UI no tiene toggles; el campo y el discriminador se conservan por si el requerimiento vuelve a los tres modos.
- **`models/poliza.model.ts` (nuevo)**: `Poliza`, `Aseguradora`, `PolizaUpdate`.
- **`contract.rules.ts`** (funciones puras nuevas): `effectiveStatus` (real o inferido), `hasNoveltyInProgress`, `availableActions` (mapa §5.1), `canAnnulNovelty` (última + tipo↔estado), `currentContractValue`, `currentTermDays`, `maxAdditionValue`/`maxExtensionDays` (topes 50 %, constantes `TOPE_ADICION`/`TOPE_PRORROGA` sustituibles — TD-006), `currentContractorDocument`, `canManageContract` (regla SUPERVISOR).
- **`repositories/contract.repository.ts`**: puerto ampliado con `activateContract`, `getAseguradoras`, `getPolizaDeNovedad`, `updatePoliza`.
- **`contract.rules.spec.ts` (nuevo)**: 26 aserciones sobre estados, acciones, anulación, acumulados, topes y roles.

### Infraestructura (`…/infrastructure/`)

- **`dtos/external-api.dto.ts`** (renombrado desde `legacy-api.dto.ts` 2026-07-23: "legacy" leía como código deprecado, cuando es justo el archivo activo con los tipos de las APIs institucionales): nuevos `ContratoEstadoDto`, `EntidadAseguradoraDto`, `PolizaDto`, `ApiResponseDto` (respuesta del PATCH); `Supervisor` con `Documento`; `NovedadMidDto` con índice laxo (los `GetNovedad*` no están documentados campo a campo).
- **`mappers/contract.mapper.ts`**: `toContractStatus` (normaliza nombres sin tildes del último registro de `contrato_estado`); `toStatus` reconoce `ENTR`; `readCandidate` extrae valor/días/cesionario por nombres candidatos (**punto único de corrección** cuando se confirmen los reales); `toContract` recibe `status`, mapea `supervisorDocument` y calcula la anulabilidad definitiva con `canAnnulNovelty`; `toPoliza`/`toAseguradora`.
- **`mappers/novelty-payload.mapper.ts` (nuevo)**: payloads de escritura — `toNoveltyPayload` (discriminador `tiponovedad` NP_*, campos del draft aplanados), `toCambioEstadoPayload` (`{Estado:{Id},FechaRegistro,NumeroContrato,Usuario,Vigencia}`), `targetStateId` (SUS→2, REI→4, TER→8), `ESTADO_CONTRATO_ID`. ⚠️ Nombres de campo por tipo = mejor aproximación documentada (gap del backend); todo ajuste va SOLO aquí.
- **`http-contract.service.ts`**: `createNovelty` = validar transición (si aplica) → `POST novedad/` → registrar estado; valida el envoltorio `Alert` (el mid responde 200 con `Type:"ERROR"`); `annulNovelty` = `PATCH novedad/{id}` con `{usuario:"CC"+documento}` (el mid revierte el estado); `activateContract`; `getAseguradoras` (core_amazon), `getPolizaDeNovedad`/`updatePoliza` (novedades_crud); `toDomain` ahora resuelve en paralelo proveedor + novedades + **estado**, y si hay cesiones reemplaza el contratista por el último cesionario. Desaparecen los `console.warn`/`TODO(escrituras)`.
- **`mock-contract.service.ts`**: implementa los 4 métodos nuevos del puerto (sigue siendo intercambiable en `app.config.ts`).

### Compartido (`src/app/shared/`)

- **`auth/user-session.service.ts` (nuevo)**: decodifica en cliente el payload del JWT del shell (claims `role`/`documento`/`email`); `usuarioRegistro()` = `"CC"+documento` (formato del legado para los registros).
- **`auth/contract-access.guard.ts` (nuevo)**: guard funcional de las rutas de creación (SUPERVISOR-único sin coincidencia de documento → redirige al dashboard).
- **`http/auth.interceptor.ts`**: `CORE_AMAZON_SERVICE` agregado a la allowlist.
- **`ui/form-field.component.ts`**: mensajes para `maxlength`, `topeAdicion`, `topeProrroga`, `maxContractValue`.
- **`util/format.util.ts`**: `termToDays` (plazo → días con mes = 30, soporta "… Y D ( d ) DÍAS" y contratos pactados en días). **`format.util.spec.ts` (nuevo)** cubre letras, plazos y los casos borde de fechas de ADR-013.

### Presentación (`…/presentation/`)

- **`contract-accordion`**: menú generado desde `availableActions` (incluye "Agregar Póliza" y "Activar Contrato" — este último emite `activate` en lugar de navegar); aviso de bloqueo por novedad en trámite; detalle con **Estado del Contrato** y **Valor Vigente** (si difiere del inicial); acciones y botón Anular ocultos en solo-consulta (`canManageContract`).
- **`dashboard-contratos`**: flujo de activación (modal de confirmación sobre `modal-shell` + vistas de éxito/error reutilizando `novelty-result`/`novelty-error`).
- **`crear-adicion-prorroga`**: ambas secciones fijas y obligatorias (requerimiento actualizado 2026-07-08 — sin toggles); topes 50 % con revalidación al cargar el contrato; `nuevoValor`/`nuevoPlazo` parten de los acumulados históricos.
- **`crear-cesion`**: topes contra el valor vigente en desembolsado/favor-cedente; tarjeta "Saldo restante para el Cesionario" (negativo en rojo) + fila en el resumen; autocomplete con `soloNaturales`.
- **`crear-terminacion`**: topes en los 3 valores; exclusión mutua de saldos (contratista>0 ⇒ universidad=0 y deshabilitada; `onClear` la rehabilita).
- **`crear-suspension`**: `maxLength(249)` + `maxlength` en el motivo.
- **`crear-poliza` (nueva página)**: catálogo de aseguradoras, precarga de la póliza de la última cesión, PUT de actualización, modal/éxito/error estándar. No extiende `CreateNoveltyPage` (no crea novedad; justificación en el TSDoc y en ARCHITECTURE.md).
- **`contractor-autocomplete`**: input `soloNaturales` (filtra NIT).
- **`contract-info-card`**: muestra el valor vigente cuando difiere del inicial.
- **`app.routes.ts`**: rutas de creación agrupadas bajo un padre con `canActivate: [contractAccessGuard]`; nueva ruta `poliza`.

### Environments

- `CORE_AMAZON_SERVICE` (nombre institucional del legado) agregado a los **tres** ambientes con la URL de `core_amazon_crud` — misma en dev/test/prod, igual que en el legado. Ningún nombre ni URL existente se modificó.

## Interpretaciones y supuestos documentados (revisar con negocio/backend)

1. **Payload de `POST novedad/`**: campos por tipo no documentados → aproximación en `novelty-payload.mapper.ts` (ADR-014). **Terminación Anticipada ya se confirmó contra una traza real** (ver addendum 2026-07-22 al final de este documento); los demás tipos (Suspensión, Cesión, Reinicio, Adición/Prórroga) siguen siendo la aproximación original, pendiente de la misma confirmación.
2. **Campos de `GetNovedad*`**: extracción por candidatos (`readCandidate`); mientras el backend no confirme nombres, los acumulados/cesionario pueden venir vacíos — el dominio degrada con gracia (suma 0 / mantiene contratista original).
3. **"Coincide con el botón habilitado"** (anulación): interpretado como "la novedad que produjo el estado actual" (interpretación #1 del plan).
4. **Regla SUPERVISOR**: sin selector de "rol activo" en el shell, se aplica solo a usuarios cuyo único rol de negocio es SUPERVISOR.
5. **Saldos de terminación**: exclusión direccional (contratista>0 manda); el doc no especifica la UX exacta, se replica el resultado (un saldo termina en 0).
6. **Avance de estado tras registrar la póliza**: sin documentar en el legado; no se hace en cliente (ambigüedad registrada).
7. **Tope de cesión** "valor total del contrato": aplicado contra el valor **vigente** (consistente con MIG-004; más permisivo que el inicial cuando hubo adiciones).
8. **Modos de Adición y Prórroga**: el plan original (§5.2.1) pedía tramitarlas por separado; el requerimiento actualizado (2026-07-08) volvió a hacerlas obligatorias juntas. La UI quedó sin toggles; el discriminador NP_* del payload se conservó por si el requerimiento cambia de nuevo.

## Qué NO se tocó

- Réplica/compensación hacia Ágora/Titan (TD-007 — backend).
- Actas/preview de documentos (exclusión del alcance).
- MIG-014 Aprobación (bloqueada por negocio).

## Addendum (2026-07-22) — Payload real de Terminación Anticipada

El usuario capturó la traza de red del cliente legado creando una Terminación Anticipada real
(contrato 435/2022) y la trajo para contrastarla contra `novelty-payload.mapper.ts`. Resultado:

- **`POST {mid}novedad/` confirmado**: el body real es plano, en snake_case, y **distinto** del
  que se venía enviando (`toNoveltyPayload` usaba `numeroContrato`/`vigencia` numérica/`usuario`,
  ninguno presente en la traza real). Se corrigió el caso `EARLY_TERMINATION` para construir su
  propio objeto con los nombres confirmados (`contrato`, `vigencia` string, `fecharegistro`,
  `numerosolicitud`, `fechasolicitud`, `fechaexpedicion`, `numerooficiosupervisor`,
  `numerooficioordenador`, `fechaoficiosupervisor`, `fechaoficioordenador`, `valor_desembolsado`,
  `saldo_contratista`, `saldo_universidad`, `fecha_terminacion_anticipada`, `fechafinefectiva`,
  `estado:"TERM"`, `enlace`). Los demás tipos (`SUSPENSION`/`ASSIGNMENT`/`RESTART`/
  `ADDITION_EXTENSION`) **no se tocaron**: siguen siendo la aproximación original hasta que se
  confirmen de la misma forma.
- **`replica`, `gestor_documental` (subida del acta) y la compensación de
  `novedades_poscontractuales`** que hace el cliente legado **no se implementan**: `replica` es
  justamente la llamada que la traza muestra fallando (confirma la decisión de ADR-014 de no
  llamarla) y el acta/PDF sigue excluido de alcance (se deja `enlace: ''`).
- **`validarCambioEstado`**: la traza del legado muestra un body en forma de arreglo
  (`[{NombreEstado:...},{...última fila de contrato_estado}]`), distinto del objeto
  `{Estado:{Id},FechaRegistro,NumeroContrato,Usuario,Vigencia}` que ya usa e implementa esta app
  (confirmado funcional en el flujo de activar contrato). Se decidió **no** replicar ese arreglo:
  nuestro propio `postman_backend_legal.md` documenta la forma de objeto, y cambiarla arriesgaba
  romper un flujo ya confirmado a partir del comportamiento de un cliente distinto. Si el backend
  llegara a rechazar la validación en Terminación específicamente, este es el punto a revisar.
- **Abierto / pendiente de confirmar con backend**:
  - `cesionario` viaja en la traza (`10`) sin ningún campo equivalente en `TerminacionDraft` ni en
    las reglas de negocio de terminación (§5.6 solo define desembolsado + saldos). Se omite del
    payload hasta que se aclare qué representa ahí.
  - `fechafinefectiva` se envía con el mismo valor que `fecha_terminacion_anticipada`
    (`fechaTerminacion` del formulario); `fechaCertificacion` (capturada en el formulario) no
    aparece en la traza y no se envía a este endpoint — podría ser exclusiva de la generación del
    acta (fuera de alcance).
- Prueba unitaria nueva: `novelty-payload.mapper.spec.ts` fija el shape confirmado.
- Nombres/URLs de environment existentes; `dev-token.ts`; switches `forceError` (se conservan como herramienta de prueba — ADR-014).
