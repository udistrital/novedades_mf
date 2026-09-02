# ADR-009 — Autenticación delegada al shell; interceptor Bearer con allowlist

**Fecha**: 2026-06-30 (interceptor) — allowlist endurecida 2026-07-06 · **Estado**: Aceptada

## Contexto

La plataforma usa OAuth2 (implicit) contra WSO2. En la arquitectura de microfrontends, el flujo de login lo ejecuta el core/root y el token queda en `localStorage` — patrón oficial de los lineamientos (`shared.md`) y del cliente legado. El gateway exige `Authorization: Bearer` en cada petición.

## Problema

Qué parte del ciclo de autenticación implementa este MF.

## Alternativas consideradas

1. Implementar el flujo OAuth en el MF (como hacía el monolito legado): duplicaría el login por MF y rompería la sesión única del shell.
2. **Solo consumir el token**: interceptor funcional que lo lee de `localStorage` y lo adjunta.

## Decisión

`shared/http/auth.interceptor.ts`: lee `access_token`/`id_token`/`token` en **cada petición** (soporta renovación por el shell, a diferencia del `RequestManager` de la guía que lo captura una vez en el constructor) y lo adjunta **solo** a las URLs de la allowlist (`environments/*_SERVICE`), evitando filtrar el token a terceros. La configuración `environment.TOKEN` se conserva con sus nombres institucionales para el flujo del shell. Existió un `dev-token.ts` como hook de desarrollo local (token pegado a mano para probar sin el shell), **eliminado el 2026-08-23**: nunca se usó con valor real y un archivo así se compila al bundle de producción si alguien lo deja lleno. Para probar sin el shell, escribir el token directamente en `localStorage`.

## Consecuencias

- (+) Sesión única gobernada por el shell; defensa en profundidad contra fuga del token.
- (−) El MF aún no interpreta el contenido del token (rol/documento): el control de acceso por rol es la tarea MIG-010 del [MIGRATION_PLAN](../../info/MIGRATION_PLAN.md).
- API nueva ⇒ agregarla a la allowlist o no llevará token (recordatorio en [DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md#cómo-consumir-un-endpoint-nuevo)).
