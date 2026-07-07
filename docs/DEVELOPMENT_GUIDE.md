# Guía de desarrollo

Manual práctico para trabajar en `novedades_mf`. Las razones de fondo están en [ARCHITECTURE.md](ARCHITECTURE.md); las convenciones de estilo en [CODING_STANDARDS.md](CODING_STANDARDS.md). Ante la duda, imita el código existente: todas las recetas de esta guía tienen un ejemplar real en el repo, citado en cada sección.

## Flujo de trabajo

1. Rama `feature/<nombre>` desde `develop`/`master` (GitFlow, lineamiento OAS).
2. Desarrollar con `npm start` (standalone en `:4209`) o montado en el shell (root + core levantados, ver README raíz).
3. Antes de commit: `npm run lint` y `npm run build` en verde. Commits con etiqueta institucional: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.

## ¿Cómo crear un nuevo componente?

- **¿Es de dominio** (habla de contratos, novedades, cesionarios)? → `domains/contratos/presentation/components/<nombre>/`. Ejemplar: `contract-info-card/`.
- **¿Es un átomo visual genérico** (podría usarse en otro dominio sin cambiarle una palabra)? → `shared/ui/`. Ejemplar: `card.component.ts`. **Antes de crear uno, revisa los existentes** — la mayoría de necesidades (campo con label flotante, modal, toggle, acciones de formulario, feedback de éxito/error) ya tienen átomo.

Plantilla mínima (así se ven todos los componentes del repo):

```ts
@Component({
  selector: 'app-mi-componente',        // prefijo app- obligatorio (regla de lint)
  standalone: true,
  imports: [/* solo lo que el template usa */],
  template: `...`                        // inline si es corto; templateUrl si supera ~40 líneas
})
export class MiComponenteComponent {
  readonly dato = input.required<Tipo>();   // input()/output()/model(), nunca decoradores nuevos
  readonly accion = output<Tipo>();
}
```

No nombres outputs como eventos nativos del DOM (`cancel`, `click`, `change`): lint lo rechaza — usa `dismiss`, `selected`, etc.

## ¿Cómo crear una nueva entidad o tipo de dominio?

En `domains/contratos/domain/models/`, como interface/enum/union **sin ninguna dependencia** (ni Angular, ni DTOs, ni environments). Documenta el concepto de negocio con TSDoc breve. Ejemplares: `contract.entity.ts`, `novelty-draft.model.ts`. Si el dato viene del backend con otra forma, esa traducción NO va aquí: va en un mapper (ver abajo).

## ¿Cómo crear un nuevo caso de uso?

Servicio en `domains/contratos/application/`, `@Injectable({ providedIn: 'root' })`, que inyecta `IContractRepository` (el puerto, nunca `HttpContractService` directo) y expone métodos con nombre de negocio. Ejemplar: `novelty.service.ts` (crear/anular). Si el caso de uso necesita estado observable por la UI, sigue el patrón de `contract-state.service.ts`:

```ts
private state = signal<MiEstado>({...});           // privado y mutable
readonly algo = computed(() => this.state().algo); // público y de solo lectura
miAccion(): void { this.repo.metodo().subscribe(...); this.state.update(...); }
```

## ¿Cómo consumir un endpoint nuevo?

Cadena completa, en este orden (ejemplar de referencia: búsqueda de contratos):

1. **URL base**: usa las de `environments/` (`ADMINISTRATIVA_PRUEBAS_SERVICE`, `NOVEDADES_MID_SERVICE`, `NOVEDADES_SERVICE`). No agregues URLs hardcodeadas; si necesitas un servicio institucional nuevo, se agrega a los 3 archivos de environment con su nombre oficial. Recuerda añadirlo a la allowlist del `auth.interceptor.ts` si debe llevar token.
2. **DTO** en `infrastructure/dtos/legacy-api.dto.ts`: campos opcionales y laxos (el esquema legado no está documentado campo a campo); el envoltorio del mid es `AlertResponse<T> = {Code, Body}`.
3. **Mapper** en `infrastructure/mappers/`: función pura DTO → entidad de dominio. Toda tolerancia al backend (nombres alternativos, strings/objetos, `[{}]` = vacío) vive aquí y en ningún otro lado.
4. **Método en el puerto** (`domain/repositories/contract.repository.ts`) y su implementación en `HttpContractService` **y** en `MockContractService` (el mock debe seguir compilando; devuelve datos quemados con `of(...).pipe(delay(...))`).
5. **Errores**: dentro del repositorio, `catchError(() => of(valorNeutro))` cuando el fallo no debe tumbar la vista (patrón de `novedadesDeContrato`); si la vista debe enterarse, deja que el error fluya y el servicio de aplicación lo captura en `subscribe({ error })` actualizando su signal de error. No uses `console.log`; `console.warn/error` solo para condiciones anormales reales.

## ¿Cómo crear un mapper?

Función pura exportada en `infrastructure/mappers/`, nombre `toXxx`. Reglas: nunca lanza por datos faltantes (devuelve valores neutros `''`/`0`/`[]`), no toca signals ni servicios, y las reglas de negocio NO van aquí — solo traducción de forma. Excepción documentada: `toNoveltySummaries` aplica la regla heredada "solo la última novedad es anulable" porque necesita ver la colección completa; si agregas reglas similares, evalúa primero si pertenecen a `domain/contract.rules.ts`.

## ¿Cómo usar Signals?

- **`signal`**: estado propio del componente o servicio. Privado si es mutable; expón `computed` o el signal `readonly`.
- **`computed`**: todo valor derivado de otros signals (ej. `nuevoValor` en adición-prórroga). Si te encuentras recalculando algo en el template o en un método, probablemente debía ser un `computed`.
- **`effect`**: **último recurso**, solo para sincronizar signals con un mundo no reactivo. Los dos usos legítimos del repo escriben un `FormControl` cuando el contrato termina de cargar (`crear-suspension`, `crear-reinicio`). No uses `effect` para derivar estado (eso es `computed`) ni para encadenar signals.
- **Formularios reactivos ↔ signals**: para leer un form como signal usa `toSignal(form.valueChanges, { initialValue: form.getRawValue() })` (ejemplar: `crear-adicion-prorroga`). Para reaccionar a un control, `valueChanges.pipe(startWith(...), takeUntilDestroyed())`.
- **RxJS sigue siendo el canal de I/O**: HTTP y valueChanges son Observables; los signals modelan el estado resultante. No conviertas todo a signals por principio.

## ¿Cómo manejar errores?

| Situación | Patrón | Ejemplar |
|---|---|---|
| Fallo de una consulta secundaria que no debe romper la principal | `catchError(() => of(valorNeutro))` en el repositorio | `novedadesDeContrato` |
| Fallo de la consulta principal de una vista | signal `error` en el servicio de estado + bloque `@else if (state.error())` | `ContractStateService.loadContracts` + dashboard |
| Fallo al crear/anular una novedad | transición a la pantalla de error estándar (`pageState = 'error'` / vista `annul-error`) con reintento | `CreateNoveltyPage.onConfirm` |
| Validación de formulario | `Validators` + errores custom vía `setErrors` sin pisar los demás + mensaje en `form-field.component.ts#errorMessage` | `crear-suspension` (`setExtraError`) |

## ¿Cómo estructurar un feature nuevo?

**Caso típico — nueva página de novedad** (receta completa):
1. Draft: nuevo miembro en la unión `NoveltyDraft` (`domain/models/novelty-draft.model.ts`) con su `type: NoveltyType.X`.
2. Página: `presentation/pages/crear-<nombre>/` extendiendo `CreateNoveltyPage`; define `noveltyName`, `form`, `buildDraft()`, `buildSummary()`, `onClear()`. Copia la estructura de la página existente más parecida.
3. Template: compón con `novelty-page-layout` + átomos (`app-card`, `app-form-field`, `appFormInput`, `novelty-form-actions`, `confirm-novelty-modal`, `novelty-result`, `novelty-error`).
4. Ruta lazy en `app.routes.ts` (`contratos/:contractId/novedades/<segmento>` — segmento en español) **antes** del comodín `**`.
5. Opción en el menú del acordeón (`contract-accordion.component.ts`) con la regla de estado correspondiente en `domain/contract.rules.ts`.
6. Reglas de negocio nuevas → funciones puras en `contract.rules.ts` o validators en la página; cálculos de fechas/plazos → reutiliza `shared/util/format.util.ts`.

**Caso mayor — dominio de negocio nuevo**: carpeta hermana `domains/<nombre>/` replicando las 4 capas; repositorio abstracto propio registrado en `app.config.ts`. No mezcles conceptos de otro negocio dentro de `contratos/`.

## Nombres de archivos y carpetas

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componente | `<nombre>.component.ts` en carpeta propia si tiene template externo | `contract-accordion/` |
| Átomo shared | archivo suelto `<nombre>.component.ts` (template inline) | `shared/ui/money-field.component.ts` |
| Servicio | `<nombre>.service.ts` | `contract-state.service.ts` |
| Entidad / modelo | `<nombre>.entity.ts` / `<nombre>.model.ts` / `<nombre>.enum.ts` | `contract.entity.ts` |
| Reglas de dominio | `<dominio>.rules.ts` | `contract.rules.ts` |
| Repositorio (puerto) | `<nombre>.repository.ts` | `contract.repository.ts` |
| DTO / mapper | `<origen>.dto.ts` / `<nombre>.mapper.ts` | `legacy-api.dto.ts` |
| Directiva | `<nombre>.directive.ts` | `form-input.directive.ts` |
| Carpetas | kebab-case; páginas con el verbo en español (`crear-cesion`) | |

## Imports

Orden observado en todo el repo (mantenerlo): (1) Angular core/común, (2) Angular forms/router/material, (3) RxJS, (4) componentes/servicios propios de capas externas, (5) `shared/`, (6) `domain/`. Rutas relativas (no hay path aliases configurados). El lint no impone el orden, pero la consistencia sí se revisa en PR.

## Pruebas

Karma + Jasmine (`npm test`). El TestBed necesita `provideRouter([])` si el componente usa router (ejemplar: `app.component.spec.ts`). Prioridad de cobertura acordada: funciones puras (`contract.rules.ts`, mappers, `format.util.ts`) antes que componentes — ver H4 en el [COMPLIANCE_REPORT](../referencias/COMPLIANCE_REPORT.md) (actualmente excluida por decisión del equipo).
