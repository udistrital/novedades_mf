# ADR-019 — La anulación exige que el contrato tenga una sola novedad

**Fecha**: 2026-09-11 · **Estado**: Aceptada (resuelve una ambigüedad abierta desde que se implementó la anulación estricta)

## Contexto

El requerimiento de anulación del sistema legado condiciona la anulación a que la novedad sea la **"única novedad"** del contrato y que *"coincida con el botón habilitado"*.

La segunda condición se entendió sin discusión: el tipo de la novedad debe corresponder al estado que produjo (se anula la Suspensión de un contrato Suspendido, la Terminación de un contrato Terminado). La primera no: *"única"* admitía dos lecturas y el equipo eligió la permisiva —**"la última"**— y la dejó registrada como ambigüedad abierta, con la nota explícita de *"confirmar si «única» es literal"*.

El **2026-09-11** negocio confirmó que **es literal**.

## Problema

Si un contrato tiene más de una novedad, ¿se puede anular la última?

## Decisión

**No.** `canAnnulNovelty` exige `contract.novelties.length === 1`: la anulación solo existe mientras el contrato tiene exactamente una novedad, y esa es la que se anula. Un contrato con dos o más no admite ninguna, ni siquiera sobre la más reciente. Las demás condiciones (que sea la última, y la correspondencia tipo↔estado) se conservan sin cambio.

El razonamiento de negocio es el mismo que sostiene toda la función: **la anulación revierte un error de digitación reciente, no deshace historia jurídica**. Con una sola novedad, "el estado anterior" es inequívoco — el contrato como se suscribió. Con varias deja de serlo, y la operación pasa a parecerse a una corrección retroactiva del expediente, que es un trámite distinto y con otras firmas.

## Consecuencias

- (+) La regla queda alineada al texto del requerimiento, sin interpretación de por medio: desaparece la ambigüedad.
- (+) Se elimina una clase entera de estados inconsistentes. El `PATCH` de anulación del mid (`AnularNovedadYRevertirEstado`) devuelve el contrato **siempre** a "En ejecución" sin mirar el historial; con una sola novedad eso es correcto salvo en el reinicio —que el cliente ya corrige con `estadoTrasAnulacion`—, pero con varias el estado correcto es el que el contrato tenía *antes* de la novedad anulada, y nadie lo está calculando.
- (−) Un error detectado tarde ya no se corrige desde el aplicativo: si al contrato le entró otra novedad después, la corrección sale del sistema. Es el costo aceptado de la regla.
- El botón "Anular" del acordeón se apaga solo: lee `novelty.canAnnul`, que el mapper calcula con esta misma función. No hay una segunda validación que mantener.

## Puerta abierta: anular la última habiendo otras

La restricción es **del trámite, no técnica**, y el diseño la deja reversible a propósito. Habilitar "la última aunque existan otras" es sustituir una condición en [`canAnnulNovelty`](../../src/app/domains/contratos/domain/contract.rules.ts):

```ts
// hoy
if (contract.novelties.length !== 1 || getLatestNovelty(contract) !== novelty) return false;
// para abrirlo
if (getLatestNovelty(contract) !== novelty) return false;
```

El resto de la función ya lo soporta: la correspondencia tipo↔estado funciona igual con historial largo, y los acumulados (`currentContractValue`, `currentTermDays`) se recalculan solos a partir de las novedades que queden, porque son derivados y no valores almacenados.

Lo que **sí habría que resolver antes** de dar ese paso:

1. **La reversión del estado.** Es el bloqueante real. El mid revierte a "En ejecución" a ciegas. Con historial, el destino correcto depende de lo que hubiera antes: anular un reinicio sobre un contrato con dos suspensiones previas debe dejarlo Suspendido; anular una adición sobre un contrato suspendido debe dejarlo Suspendido, no en ejecución. Hoy `estadoTrasAnulacion` solo cubre el caso del reinicio y lo hace desde el cliente, compensando después del `PATCH`. La solución correcta es que el mid calcule el estado anterior, o que el cliente lo derive del historial restante con `effectiveStatus` y lo registre — lo segundo es viable con lo que ya existe.
2. **El valor restituido en el mid.** `AnularNovedadYRevertirEstado` restituye el valor del contrato para los tipos 8, 1 y 2 y vuelve a replicar los meses del período restituido. Con varias novedades hay que verificar contra qué base lo restituye, porque el cliente ya no puede asumir que es el valor de suscripción.
3. **Confirmación de negocio**, que es la que cierra la decisión: esta ADR la reversa cuando exista.

Mientras tanto, la puerta se deja señalizada en el código (`canAnnulNovelty`, `domain/contract.rules.ts`) para que quien la abra sepa qué encontrará detrás.
