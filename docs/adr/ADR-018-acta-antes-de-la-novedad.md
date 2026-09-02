# ADR-018 — El acta se genera antes de registrar la novedad

**Fecha**: 2026-08-24 · **Estado**: Aceptada (reemplaza la sección *"El acta corre después de la novedad y no puede tumbarla"* de [ADR-016](ADR-016-generacion-de-actas-desacoplada.md); el resto de ADR-016 sigue vigente)

## Contexto

[ADR-016](ADR-016-generacion-de-actas-desacoplada.md) encadenó la generación del acta **al éxito** de la creación:

```
crear novedad (cascada completa)  →  generar acta  →  descargar
```

y para eso `ActaGeneratorService.generarYDescargar` **nunca fallaba**: capturaba el error, lo dejaba en un signal y completaba. El razonamiento era correcto en su momento: el PDF no se envía al backend, así que no forma parte de la transacción, y un fallo suyo no debía convertir una novedad ya registrada en un error.

Ese orden tiene dos consecuencias que la práctica volvió incómodas:

1. **Se puede registrar una novedad que nunca tuvo acta.** El acta es el documento jurídico que formaliza la novedad; una novedad registrada sin él queda incompleta y no hay forma de deshacerla (solo anularla, que es otro trámite).
2. **El PDF no existe cuando la cascada lo necesitaría.** `gestor_documental` recibe hoy `file: ''` (hueco F1). Archivar el acta algún día es imposible mientras se genere *después* del paso que debería subirla.

## Problema

En qué orden llamar al middleware de actas y a la cascada de escritura.

## Decisión

**El acta primero.** El orden pasa a ser:

```
generar acta  →  crear novedad (cascada completa)  →  descargar
```

- Si el acta **no se puede generar, no se escribe nada**: el error sube a la pantalla de error estándar y el usuario puede reintentar el trámite completo, porque todavía no existe.
- La **descarga se deja para el final**, cuando el registro ya está confirmado: así el usuario nunca recibe el acta de una novedad que no llegó a existir.
- `ActaGeneratorService` deja de tragarse los errores. Queda partido en tres operaciones explícitas: `generar` (propaga), `descargar` (de un documento ya generado) y `previsualizar`.

## Consecuencias

- (+) Deja de ser posible una novedad registrada sin su acta.
- (+) El base64 está disponible **antes** de la cascada, que era el requisito técnico para archivar el PDF en `gestor_documental`. **Cerrado**: el PDF viaja en `file` y por eso "Ver acta" ya funciona. Se encendió por tipos —adición y prórroga el 2026-08-27, suspensión el 2026-08-28— y ese mismo día se completaron los cinco, así que el interruptor `NOVEDAD_BACKEND.archivaActa` desapareció: ya no hay ninguna novedad que registre el documento vacío. Solo aplica a las novedades **nuevas**; las creadas antes de esas fechas siguen sin documento.
- (+) Desaparece el reintento posterior: `actaWarning`, `reintentandoActa`, `reintentarActa()` y el bloque de aviso de `novelty-result` se eliminaron porque quedaban **inalcanzables** — con el acta primero, un fallo nunca llega a la pantalla de éxito.
- (−) **`actas_novedad_mid` pasa a ser un bloqueante duro para crear novedades.** Si el servicio está caído, no se puede tramitar ninguna. Antes la novedad se registraba igual y solo se avisaba del acta faltante. Es el precio de la garantía, y hay que tenerlo presente: el servicio es **temporal y hoy corre en `localhost:8080` en los tres ambientes** ([Fase 7](../PLAN_TRABAJO.md) del plan), así que en un ambiente desplegado sin ese middleware **no se podría crear ninguna novedad**. Revertir a "el acta no bloquea" es un cambio de una línea en `CreateNoveltyPage.onConfirm`, pero implica volver a aceptar novedades sin acta.
- La generación **no** se reintenta automáticamente ni se cachea entre intentos: cada confirmación pide el PDF de nuevo, con los datos del formulario en ese momento.
