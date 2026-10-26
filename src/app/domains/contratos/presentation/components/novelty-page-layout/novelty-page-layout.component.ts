import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../../../shared/ui/breadcrumb.component';
import { ContractInfoCardComponent } from '../contract-info-card/contract-info-card.component';
import { Contract } from '../../../domain/models/contract.entity';
import { ApiErrorInfo } from '../../../../../shared/http/api-error';

/**
 * Estructura común de las vistas de creación de novedad: migas de pan, título,
 * botón "Volver", y grid de 2 columnas (contexto a la izquierda, formulario a la derecha).
 * El formulario se proyecta por defecto; tarjetas extra de contexto van en el slot [aside].
 *
 * Si el contrato no se pudo cargar muestra el motivo **en lugar** del formulario:
 * sin contrato no hay contexto que validar ni datos que enviar, así que dejar el
 * formulario visible solo lleva a un error al confirmar. Es el punto único donde
 * eso se resuelve para las seis vistas.
 */
@Component({
  selector: 'app-novelty-page-layout',
  standalone: true,
  imports: [RouterLink, MatIconModule, BreadcrumbComponent, ContractInfoCardComponent],
  template: `
    <main class="flex-grow w-full max-w-7xl mx-auto px-container-margin-mobile md:px-container-margin-desktop pt-2 pb-stack-lg flex flex-col gap-stack-md">
      <div class="flex flex-col gap-stack-sm">
        <app-breadcrumb [items]="breadcrumbItems()" />
        <h1 class="font-headline-lg text-headline-lg text-primary">{{ title() }}</h1>
      </div>

      <div class="flex justify-end">
        <a routerLink="/"
          class="inline-flex items-center gap-2 px-4 py-2 border border-primary-container text-primary rounded hover:bg-primary-fixed transition-colors font-label-lg text-label-lg">
          <mat-icon class="text-[20px] flex items-center justify-center">arrow_back</mat-icon> Volver al Seguimiento
        </a>
      </div>

      @if (error(); as e) {
        <div role="alert"
          class="bg-surface-container-lowest border border-error/40 rounded-xl p-stack-lg flex items-start gap-stack-md">
          <mat-icon class="text-error flex items-center justify-center">error</mat-icon>
          <div class="flex flex-col gap-1">
            <p class="font-title-md text-title-md text-on-surface">{{ e.detail }}</p>
            @if (e.action) {
              <p class="font-body-md text-body-md text-on-surface-variant">{{ e.action }}</p>
            }
            <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">
              Código: {{ e.code }}@if (e.origen) { · Servicio: {{ e.origen }} }
            </p>
          </div>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg items-start">
          <div class="lg:col-span-4 flex flex-col gap-stack-md">
            @if (contract(); as c) {
              <app-contract-info-card [contract]="c" />
            }
            <ng-content select="[aside]" />
          </div>
          <div class="lg:col-span-8 flex flex-col gap-stack-lg">
            <ng-content />
          </div>
        </div>
      }
    </main>
  `
})
export class NoveltyPageLayoutComponent {
  readonly title = input.required<string>();
  readonly breadcrumbItems = input.required<BreadcrumbItem[]>();
  readonly contract = input.required<Contract | undefined>();
  /** Motivo por el que el contrato no se pudo cargar; sustituye al formulario. */
  readonly error = input<ApiErrorInfo | null>(null);
}
