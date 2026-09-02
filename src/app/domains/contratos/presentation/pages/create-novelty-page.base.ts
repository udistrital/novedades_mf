import { Directive, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { ContractStateService } from '../../application/contract-state.service';
import { NoveltyService } from '../../application/novelty.service';
import { ActaGeneratorService } from '../../application/acta-generator.service';
import { NoveltyDraft } from '../../domain/models/novelty-draft.model';
import { NoveltyDocument } from '../../domain/models/novelty-document.model';
import { NoveltySummaryItem } from '../components/confirm-novelty-modal/confirm-novelty-modal.component';
import { BreadcrumbItem } from '../../../../shared/ui/breadcrumb.component';
import { formatExecutionDate } from '../../../../shared/util/format.util';
import { ApiErrorInfo, describeApiError } from '../../../../shared/http/api-error';

export type NoveltyPageState = 'form' | 'success' | 'error';

/**
 * Lógica común a las páginas de creación de novedad: carga del contrato,
 * apertura del modal de confirmación y transición a éxito/error.
 * Cada página concreta aporta su formulario y define `noveltyName`,
 * `buildDraft()` y `buildSummary()`.
 */
@Directive()
export abstract class CreateNoveltyPage {
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly noveltyService = inject(NoveltyService);
  protected readonly actaGenerator = inject(ActaGeneratorService);
  readonly state = inject(ContractStateService);

  protected readonly contractId = this.route.snapshot.paramMap.get('contractId') ?? '';

  readonly submitting = signal(false);
  readonly showConfirm = signal(false);
  /** Máquina de estados de la vista: formulario → pantalla de éxito o de error. */
  readonly pageState = signal<NoveltyPageState>('form');
  /** Fecha/hora legible del registro, mostrada en la pantalla de éxito. */
  readonly executedAt = signal('');
  /** Campos del resumen mostrados en el modal de confirmación. */
  readonly summary = signal<NoveltySummaryItem[]>([]);
  /** Error real de la última creación fallida, ya traducido para el usuario. */
  readonly errorInfo = signal<ApiErrorInfo | null>(null);
  /** Previsualización del acta en curso (deshabilita el botón). */
  readonly previsualizando = signal(false);
  /** Motivo por el que la última previsualización falló; vacío si todo salió bien. */
  readonly previewError = signal('');
  /**
   * Tamaño de letra del acta, en puntos. Lo controla el usuario desde la vista y
   * viaja al servicio como `tamano_letra`; el rango (1-50) y el valor por defecto
   * (10) los impone el propio middleware.
   */
  readonly tamanoLetra = signal(10);

  /** Vigencia (VigenciaContrato), tomada del id compuesto `${numero}_${vigencia}`. */
  readonly year = computed(() => this.state.selectedContract()?.id?.split('_').pop() ?? '');

  /**
   * Las dos migas que vuelven al panel llevan el contrato en la URL, igual que el
   * botón "Volver al Seguimiento": sin eso el panel se repuebla solo si quedan
   * filtros en memoria, y tras una recarga aparecía en blanco.
   */
  readonly breadcrumb = computed<BreadcrumbItem[]>(() => {
    const alPanel = volverAlContrato(this.contractId);
    return [
      { label: 'Seguimiento Legal', link: '/', queryParams: alPanel },
      { label: `Contrato No. ${this.state.selectedContract()?.number ?? ''}`, link: '/', queryParams: alPanel },
      { label: `Crear ${this.noveltyName}` }
    ];
  });

  /** Nombre legible de la novedad (p. ej. "Adición y Prórroga"). */
  abstract readonly noveltyName: string;
  /** Formulario de la página concreta; se valida antes de abrir la confirmación. */
  abstract readonly form: FormGroup;
  /** Construye el draft a enviar al repositorio. */
  protected abstract buildDraft(): NoveltyDraft;
  /** Construye los campos del resumen mostrados en el modal de confirmación. */
  protected abstract buildSummary(): NoveltySummaryItem[];

  constructor() {
    this.state.loadContract(this.contractId);
    // form → success/error no navega de ruta: hay que subir el scroll a mano.
    effect(() => {
      this.pageState();
      window.scrollTo(0, 0);
    });
  }

  /**
   * Submit del formulario: si es válido abre el modal de confirmación con el
   * resumen de la página concreta; si no, marca los controles y lleva el foco
   * al primer campo inválido.
   */
  onSubmit(event: Event): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const formEl = event.target as HTMLElement;
      // Prioriza inputs nativos; si el primer inválido es un componente propio (p. ej. el
      // autocomplete de contratista), Angular pone `ng-invalid` en su host, no en un input/select/textarea.
      const firstInvalid =
        formEl.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid') ??
        formEl.querySelector<HTMLElement>('.ng-invalid');
      firstInvalid?.focus({ preventScroll: true });
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.summary.set(this.buildSummary());
    this.showConfirm.set(true);
  }

  closeConfirm(): void {
    this.showConfirm.set(false);
  }

  /**
   * Confirmación definitiva: envía el draft al caso de uso de creación y
   * transiciona la vista a éxito o error según el resultado.
   *
   * @param forceError Switch de pruebas del modal para simular una falla.
   */
  onConfirm(forceError = false): void {
    const draft = this.buildDraft();
    const contract = this.state.selectedContract();
    this.submitting.set(true);
    this.errorInfo.set(null);
    // El acta va PRIMERO: si el documento que formaliza la novedad no se puede
    // generar, no se escribe nada. La descarga se deja para el final, cuando el
    // registro ya está confirmado — así el usuario nunca recibe el acta de una
    // novedad que no llegó a existir.
    const acta$: Observable<NoveltyDocument | null> = contract
      ? this.actaGenerator.generar(contract, draft, this.tamanoLetra())
      : of(null);
    acta$.pipe(
      switchMap(doc =>
        // El PDF recién generado viaja a la cascada para archivarse en el gestor
        // documental: es lo que hace que "Ver acta" funcione después.
        this.noveltyService.create(this.contractId, draft, doc?.base64 ?? '', forceError).pipe(map(() => doc))
      )
    ).subscribe({
      next: doc => {
        if (doc) this.actaGenerator.descargar(doc);
        this.submitting.set(false);
        this.showConfirm.set(false);
        this.executedAt.set(formatExecutionDate());
        this.pageState.set('success');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.showConfirm.set(false);
        // El error viaja a la vista: es el único lugar donde el usuario puede
        // enterarse de por qué falló y qué hacer.
        this.errorInfo.set(describeApiError(err));
        this.pageState.set('error');
      }
    });
  }

  /** Reintentar tras un error: vuelve al formulario. */
  onRetry(): void {
    this.pageState.set('form');
  }

  /**
   * Previsualiza el acta sin registrar nada: la genera con lo que hay en el
   * formulario y la abre en otra pestaña, **sin descargar ningún archivo**.
   *
   * Exige el formulario válido porque el acta se arma con esos mismos datos: sin
   * ellos el servicio la rechazaría con un error de validación que no le dice nada
   * al usuario. Marcar los controles hace visibles los campos que faltan.
   */
  previsualizarActa(): void {
    if (this.previsualizando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const contract = this.state.selectedContract();
    if (!contract) return;

    this.previewError.set('');
    this.previsualizando.set(true);
    this.actaGenerator.previsualizar(contract, this.buildDraft(), this.tamanoLetra()).subscribe({
      complete: () => this.previsualizando.set(false),
      error: (err: unknown) => {
        this.previsualizando.set(false);
        this.previewError.set(`No se pudo generar la previsualización: ${describeApiError(err).detail}`);
      }
    });
  }

  /**
   * Vuelve al panel **consultando el contrato que se acaba de tramitar**.
   *
   * El número y la vigencia viajan en la URL en vez de confiar solo en los filtros
   * en memoria: así el listado se repuebla aunque el usuario haya llegado por enlace
   * directo o haya recargado la página, casos en los que el estado en memoria está
   * vacío y el panel aparecía en blanco.
   */
  goBack(): void {
    this.router.navigate(['/'], { queryParams: volverAlContrato(this.contractId) });
  }
}

/**
 * Parámetros con los que el panel vuelve a consultar un contrato, a partir del id
 * compuesto `${numero}_${vigencia}`. Vacío si el id no trae número: sin él, el panel
 * se queda como estaba en vez de lanzar una búsqueda sin criterio.
 */
export function volverAlContrato(contractId: string): Record<string, string> {
  const [numero, vigencia] = contractId.split('_');
  return numero ? { contrato: numero, vigencia: vigencia ?? '' } : {};
}
