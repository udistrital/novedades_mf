# El dominio: novedades poscontractuales

Descripción funcional del negocio que implementa este microfrontend. Los términos marcados en **negrita** están también en el [GLOSARIO](GLOSSARY.md). Fuente: requerimientos levantados del sistema legado (`referencias/requerimientos_novedades_original.md`) y código actual; donde el negocio aún debe pronunciarse se indica.

## El problema de negocio

La Universidad Distrital suscribe **contratos** (típicamente de prestación de servicios) con **contratistas** (personas naturales o jurídicas). Durante la ejecución de un contrato ocurren eventos jurídicos que lo modifican — se le agrega dinero, se pausa, se transfiere a otra persona, se termina antes de tiempo. Cada uno de esos eventos es una **novedad poscontractual** y debe quedar formalizada en un **acta** con soporte documental. Este MF es la herramienta del área jurídica (rol de **Seguimiento Legal**) para consultar contratos y tramitar esas novedades.

## Conceptos y relaciones

- **Contrato**: acuerdo suscrito, identificado en el negocio por el par **número + vigencia** (año); no existe un id único — por eso el sistema usa el id compuesto `numero_vigencia`. Tiene un contratista, un **objeto** (qué se contrató), un **valor total**, un **plazo inicial** (expresado como "NUEVE ( 9 ) MESES"), un **supervisor** y un **ordenador del gasto**.
- **Novedad**: modificación formal sobre un contrato. Un contrato tiene 0..n novedades ordenadas cronológicamente por su **fecha de expedición** (la del acta). Algunas novedades tienen además **fecha efectiva** distinta (cuándo surte efecto realmente, p. ej. el inicio real de una suspensión).
- **Contratista / Cedente / Cesionario**: el contratista vigente ejecuta el contrato. En una cesión, el contratista actual pasa a ser el **cedente** y quien lo reemplaza es el **cesionario** (identificado por documento). Tras una cesión, el "contratista vigente" del contrato es el último cesionario.
- **Supervisor** y **Ordenador del gasto**: responsables institucionales que firman/avalan; sus oficios (número y fecha) son insumos de casi toda novedad.

## Tipos de novedad

| Novedad | Qué hace | Particularidades |
|---|---|---|
| **Adición y Prórroga** | Aumenta el valor y/o extiende el plazo | Aplican por separado o juntas. Topes legales: adición ≤ 50 % del valor vigente; prórroga ≤ 50 % del plazo vigente (pendiente de implementar — MIG-005) |
| **Suspensión** | Pausa temporal de la ejecución | Requiere motivo; período mínimo 1 día; la fecha de reinicio esperada se deriva (fin + 1 día) |
| **Reinicio** | Levanta una suspensión | Solo posible si la última novedad es una suspensión; hereda sus fechas |
| **Cesión** | Transfiere el contrato a un cesionario | La terminación del cedente es la víspera de la cesión; tras la cesión el contrato queda pendiente de póliza del nuevo contratista |
| **Terminación Anticipada** | Liquidación bilateral antes del plazo | Captura valor desembolsado y saldos a favor de cada parte; el contrato queda en "fin anticipado" |
| Prórroga en Tiempo | Variante de solo plazo (catálogo del backend) | El dominio la distingue como tipo, comparte trámite con Adición y Prórroga |

El legado declaraba además Liquidación, Otrosí (aclaratorio/modificatorio) y una consulta transversal de novedades que **nunca fueron funcionalidad real**; su alcance debe re-especificarse con negocio antes de existir aquí (TD-001..003 del [MIGRATION_PLAN](../MIGRATION_PLAN.md)).

## Reglas del dominio

### Vigentes en el código

1. **Solo la última novedad es anulable.** Anular deshace el último evento jurídico; nunca uno intermedio.
2. **Contrato suspendido ⇒ única acción posible: Reinicio.** La suspensión se detecta porque la última novedad es de tipo Suspensión (un reinicio posterior la "destapa").
3. **Derivación de fechas**: reinicio esperado = fin de suspensión + 1 día; terminación del cedente = fecha de cesión − 1 día; inicio de suspensión ≥ inicio del contrato + 1 día; período mínimo de suspensión = 1 día. Las fechas derivadas son de solo lectura para el usuario.
4. **Mes = 30 días.** Toda aritmética de plazos convierte meses a días con factor fijo 30 (regla contable heredada; su vigencia normativa está por confirmar — TD-010).
5. **Los plazos se expresan en letras y números**: "NUEVE ( 9 ) MESES", incluidos los cálculos derivados ("… Y QUINCE ( 15 ) DÍAS"). Los valores monetarios de actas van también en letras ("… PESOS").
6. **Vigencias válidas**: del año actual hacia atrás hasta 2015 (primer año con contratos en el sistema).
7. **La búsqueda siempre exige un criterio** (número de contrato o contratista): el universo de contratos es demasiado grande para listarlo.

### Del negocio, pendientes de implementar (ver [MIGRATION_PLAN](../MIGRATION_PLAN.md))

- Topes del 50 % en adición/prórroga, calculados sobre el valor/plazo **vigente** (base + novedades históricas acumuladas), no sobre el inicial.
- Valores de cesión y terminación topados al valor del contrato; saldo del cesionario = total − (favor cedente + desembolsado); en terminación, el saldo queda a favor de una única parte.
- Mapa completo de estados del contrato (en ejecución / suspendido / cesión pendiente de póliza / finalizado / cancelado / inicio) gobernando las acciones disponibles, incluido el bloqueo cuando hay una novedad **en trámite**.
- Autorización: un **supervisor** solo tramita novedades de contratos donde su documento coincide con el del supervisor del contrato.

## Estados

- **De una novedad**: *En trámite* (bloqueará nuevas novedades), *En ejecución*, *Terminada*.
- **De un contrato** (catálogo del legado, aún no mapeado del backend): En ejecución, Suspendido, Cesión pendiente de póliza, Finalizado, Cancelado, Inicio, Fin anticipado.

## Fuentes de datos del dominio

Los contratos y proveedores viven en el sistema administrativo institucional (**Ágora** / `administrativa_amazon_api`); las novedades en el par **novedades_crud** (persistencia) + **novedades_mid** (orquestación/consulta). Históricamente cada novedad se registra en Novedades **y** se replica en Ágora — la consistencia entre ambos es un problema abierto de arquitectura backend (TD-007).
