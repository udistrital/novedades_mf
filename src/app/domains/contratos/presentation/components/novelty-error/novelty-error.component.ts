import { Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackCardComponent } from '../../../../../shared/ui/feedback-card.component';
import { ApiErrorInfo, ERROR_DESCONOCIDO, errorReportText } from '../../../../../shared/http/api-error';
import { SOPORTE_IRIS_URL } from '../../../../../shared/soporte';

/** Pantalla de error tras fallar la creación o anulación de una novedad. */
@Component({
  selector: 'app-novelty-error',
  standalone: true,
  imports: [MatIconModule, FeedbackCardComponent],
  template: `
    <app-feedback-card
      variant="error"
      icon="error"
      [title]="title()"
      [message]="displayMessage()">

      <div details class="w-full bg-error-container/20 border-l-4 border-error p-stack-md rounded-r-lg mb-stack-lg text-left">
        <div class="flex items-start gap-stack-sm">
          <mat-icon class="text-error mt-0.5 flex items-center justify-center">info</mat-icon>
          <div class="flex-1">
            <span class="block text-label-lg font-label-lg text-on-error-container font-bold">Código de error: {{ info().code }}</span>
            <span class="block text-body-md font-body-md text-on-surface-variant">{{ info().detail }}</span>
            <!-- Dónde falló: es lo que le permite a soporte ubicar el servicio sin
                 tener que reproducir el trámite. Solo existe en errores HTTP. -->
            @if (info().origen) {
              <span class="block text-label-sm font-label-sm text-on-surface-variant">Servicio: {{ info().origen }}</span>
            }
            @if (info().action) {
              <span class="block mt-stack-sm text-body-md font-body-md text-on-surface font-medium">{{ info().action }}</span>
            }
          </div>

          <!-- Alineado a la derecha del aviso, con el icono sobre el rótulo. El
               subrayado va solo en el texto: aplicado al botón entero también
               subrayaba el icono. -->
          <button
            type="button"
            (click)="copiarDetalle()"
            class="group shrink-0 flex flex-col items-center gap-0.5 text-primary hover:text-primary-container transition-colors">
            <mat-icon class="text-[20px] flex items-center justify-center">{{ copia() === 'ok' ? 'check' : 'content_copy' }}</mat-icon>
            <span class="text-label-sm font-label-sm group-hover:underline underline-offset-2">{{ textoCopiar() }}</span>
          </button>
        </div>
      </div>

      <!-- Durante el reintento se bloquean las acciones que escriben: un segundo
           clic dispararía una petición paralela sobre la misma novedad. Contactar
           soporte no se bloquea: abre otra pestaña y no toca la operación. -->
      <button
        actions
        type="button"
        (click)="retry.emit()"
        [disabled]="retrying()"
        [attr.aria-busy]="retrying()"
        class="bg-primary hover:bg-primary-container text-white px-8 py-3 rounded-lg font-title-md flex items-center justify-center gap-stack-sm transition-all shadow-md active:scale-95 disabled:bg-primary/50 disabled:shadow-none disabled:cursor-not-allowed">
        @if (retrying()) {
          <mat-icon class="animate-spin flex items-center justify-center">sync</mat-icon> Reintentando…
        } @else {
          <mat-icon class="flex items-center justify-center">refresh</mat-icon> Reintentar
        }
      </button>
      <a
        actions
        [href]="soporteUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="border border-primary text-primary hover:bg-primary/5 px-8 py-3 rounded-lg font-title-md flex items-center justify-center gap-stack-sm transition-all active:scale-95 no-underline">
        <mat-icon class="flex items-center justify-center">support_agent</mat-icon> Contactar Soporte
      </a>

      @if (retrying()) {
        <p role="status" class="mt-stack-md text-body-md font-body-md text-on-surface-variant">
          Reintentando la operación. No cierres ni recargues la página.
        </p>
      }

      <button
        type="button"
        (click)="back.emit()"
        [disabled]="retrying()"
        class="mt-stack-lg text-label-lg font-label-lg text-on-surface-variant hover:text-primary underline underline-offset-4 transition-colors disabled:text-on-surface-variant/40 disabled:no-underline disabled:hover:text-on-surface-variant/40 disabled:cursor-not-allowed">
        Volver al Panel de Gestión
      </button>
    </app-feedback-card>
  `
})
export class NoveltyErrorComponent {
  readonly noveltyName = input.required<string>();
  /** Reintento en curso: muestra el estado de carga y bloquea las acciones. */
  readonly retrying = input(false);
  /** Error real de la operación; si no llega, se muestra el genérico. */
  readonly error = input<ApiErrorInfo | null>(null);
  /** Título; por defecto el de creación. */
  readonly title = input('Error al Crear Novedad');
  /** Mensaje; si se omite, se genera a partir de `noveltyName` (caso creación). */
  readonly message = input('');

  readonly retry = output<void>();
  readonly back = output<void>();

  protected readonly soporteUrl = SOPORTE_IRIS_URL;

  protected readonly info = computed(() => this.error() ?? ERROR_DESCONOCIDO);

  /** Resultado del último intento de copia; decide el rótulo y el icono del botón. */
  protected readonly copia = signal<'idle' | 'ok' | 'fail'>('idle');

  protected readonly textoCopiar = computed(() =>
    ({ idle: 'Copiar error', ok: 'Copiado', fail: 'No se pudo copiar' })[this.copia()]
  );

  /**
   * Copia el reporte completo (código, detalle, servicio y fecha) para pegarlo en
   * el ticket de soporte. Sin esto el usuario transcribe a mano el código de error,
   * que es justo el dato que más se equivoca al copiarse.
   *
   * El portapapeles puede no estar disponible (contexto no seguro o permiso
   * denegado): el botón lo dice en vez de fingir que copió.
   */
  protected copiarDetalle(): void {
    navigator.clipboard
      ?.writeText(errorReportText(this.info(), this.noveltyName()))
      .then(() => this.copia.set('ok'))
      .catch(() => this.copia.set('fail'));
  }

  protected readonly displayMessage = computed(() =>
    this.message() ||
    `No se pudo registrar la novedad de ${this.noveltyName().toLowerCase()}.`
  );
}
