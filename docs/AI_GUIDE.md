# Guía para agentes de IA

Instrucciones operativas para trabajar en `novedades_mf` sin degradar su arquitectura. Lee esto primero; profundiza solo en lo que tu tarea necesite.

## Orden de lectura según la tarea

| Tarea | Consulta primero |
|---|---|
| Cualquier cambio de código | [CODING_STANDARDS.md](CODING_STANDARDS.md) + el ejemplar existente más parecido |
| Nueva funcionalidad / página / endpoint | [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) (recetas con ejemplares) |
| Entender una regla de negocio | [DOMAIN.md](DOMAIN.md), luego `domain/contract.rules.ts` |
| Implementar funcionalidad faltante del legado | [`MIGRATION_PLAN.md`](../MIGRATION_PLAN.md) — tu tarea probablemente ya existe como MIG-XXX con archivos y criterios |
| Duda arquitectónica ("¿dónde va esto?") | [ARCHITECTURE.md](ARCHITECTURE.md) + [adr/](adr/) |
| Cumplimiento de lineamientos institucionales | [`referencias/COMPLIANCE_REPORT.md`](../referencias/COMPLIANCE_REPORT.md) |

## Reglas que NUNCA deben romperse

1. **No rompas la integración single-spa**: `main.single-spa.ts` debe seguir exportando `bootstrap/mount/unmount`; el build debe seguir siendo UMD `novedades-mf`; `APP_BASE_HREF='/novedades'` no se toca; zone.js no se agrega a `polyfills`.
2. **Regla de dependencia entre capas** ([ARCHITECTURE.md](ARCHITECTURE.md#capas-ddd)): jamás importes `infrastructure/` desde presentación, ni Angular/HTTP desde `domain/`.
3. **El acceso a datos pasa por `IContractRepository`**: nunca inyectes `HttpClient` o `HttpContractService` en un componente. El binding real/mock vive solo en `app.config.ts`.
4. **Estado de UI = signals** (privado mutable, público `computed`/readonly). Nada de `BehaviorSubject` como store ni `effect` para derivar estado.
5. **Nada de estilos globales sin ámbito** y Preflight de Tailwind permanece desactivado: el MF comparte DOM con el shell. Todo selector global nuevo se ancla a `novedades-mf`.
6. **No cambies los nombres de variables de environment** (`*_SERVICE`, `TOKEN`): son institucionales. URLs de API solo desde `environments/`; APIs nuevas entran también a la allowlist del interceptor.
7. **Compatibilidad Angular 18**: no actualices el framework ni introduzcas APIs de versiones posteriores.
8. **Verificación obligatoria** antes de dar por terminado: `npm run lint` y `npm run build` en verde (y `npm test` si tocaste lógica). Si el build falla, se corrige antes de continuar.
9. **Las decisiones con ADR se respetan**: cambiar una requiere escribir un ADR nuevo que la reemplace (`Estado: reemplaza a ADR-XXX`), no un cambio silencioso.

## Cómo implementar sin romper

- **Imita, no inventes**: cada receta de la [guía de desarrollo](DEVELOPMENT_GUIDE.md) cita un ejemplar real del repo. La nueva página de novedad se parece a `crear-suspension`; el nuevo endpoint, a la cadena de búsqueda de contratos; el nuevo átomo, a `money-field`.
- **Reglas de negocio → `domain/contract.rules.ts`** como funciones puras; los componentes las consumen, no las contienen.
- **Backend legado hostil**: campos con nombres alternativos, `[{}]` como lista vacía, envoltorio `{Code, Body}`. Toda esa tolerancia va en DTOs laxos + mappers — si tu código de dominio necesita un `?? ''`, probablemente el mapper quedó incompleto.
- **Español/inglés**: tipos y clases en inglés; UI, rutas y campos de drafts en español (los drafts hablan el idioma del backend).
- **Si el usuario pide algo que contradice un ADR o un lineamiento**, señálalo antes de implementar.

## Errores comunes a evitar (vistos u observados en el legado)

- Conectar una escritura y olvidar `MockContractService`: **ambas** implementaciones del puerto deben compilar y comportarse coherentemente.
- Agregar una ruta después del comodín `**` en `app.routes.ts` (quedaría inalcanzable).
- Usar `ngIf/ngFor/CommonModule` (el proyecto es 100 % control flow nuevo) o decoradores `@Input/@Output` en código nuevo.
- Nombrar un output como evento nativo (`cancel`) — el lint lo rechaza; el precedente del repo es `dismiss`.
- Reimplementar en el cliente cálculos que el backend posee (ej. saldos presupuestales `SaldoCdp` — regla explícita del legado).
- Confiar en el módulo de Aprobación del legado como especificación (está roto; ver MIG-014).
- Duplicar utilidades existentes: revisa `shared/util/format.util.ts` (fechas, plazos, moneda, letras) y `shared/ui/` antes de crear helpers o componentes.
- Escribir signals dentro de `effect` para "sincronizar" estado (usa `computed`) o llamar `detectChanges()` (la app es zoneless: si la vista no reacciona, el estado no es un signal).

## Estado del proyecto que debes conocer

- **Las escrituras están conectadas** ([ADR-014](adr/ADR-014-escrituras-reales-sin-replica.md)): crear novedad = validar transición → `POST {mid}novedad/` → registrar estado; anular = `PATCH {mid}novedad/{id}`. **Sin réplica a Ágora/Titan ni compensación en cliente** (TD-007 es de backend). Los nombres de campo del payload por tipo son aproximación documentada: si el backend los rechaza, se corrige ÚNICAMENTE `infrastructure/mappers/novelty-payload.mapper.ts`.
- Igual de corregible en un solo punto: la extracción de valor de adición / días de prórroga / cesionario de las respuestas del mid (`readCandidate` en `contract.mapper.ts`) usa nombres candidatos porque los `GetNovedad*` no están documentados campo a campo.
- Los parámetros `forceError` y el switch del modal **se conservan** como herramienta de prueba de los caminos de error de la UI (decisión registrada en ADR-014).
- `dev-token.ts` es un hook de desarrollo local con instrucciones de borrado en su cabecera; su token debe permanecer vacío en commits.
- El estado real del contrato **sí se lee** de `contrato_estado` y gobierna el menú de acciones (`availableActions`); cuando el backend no tiene registro se infiere (`effectiveStatus`). El control por rol vive en `shared/auth/` + `canManageContract`.
- El plan de pruebas manual por funcionalidad está en [TEST_PLAN.md](TEST_PLAN.md); el detalle de la ejecución del plan de migración, en [REVISION_CAMBIOS.md](REVISION_CAMBIOS.md).
- Generación/previsualización de actas (PDF) quedó explícitamente FUERA de esta fase, igual que el módulo de Aprobación (MIG-014, bloqueado por negocio).
