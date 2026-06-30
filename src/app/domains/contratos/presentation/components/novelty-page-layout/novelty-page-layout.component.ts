import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BreadcrumbComponent, BreadcrumbItem } from '../../../../../shared/ui/breadcrumb.component';
import { ContractInfoCardComponent } from '../contract-info-card/contract-info-card.component';
import { Contract } from '../../../domain/models/contract.entity';

/**
 * Estructura común de las vistas de creación de novedad: migas de pan, título,
 * botón "Volver", y grid de 2 columnas (contexto a la izquierda, formulario a la derecha).
 * El formulario se proyecta por defecto; tarjetas extra de contexto van en el slot [aside].
 */
@Component({
  selector: 'app-novelty-page-layout',
  standalone: true,
  imports: [RouterLink, MatIconModule, BreadcrumbComponent, ContractInfoCardComponent],
  template: `
    <main class="flex-grow w-full max-w-7xl mx-auto px-container-margin-mobile md:px-container-margin-desktop py-stack-lg flex flex-col gap-stack-md">
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
    </main>
  `
})
export class NoveltyPageLayoutComponent {
  readonly title = input.required<string>();
  readonly breadcrumbItems = input.required<BreadcrumbItem[]>();
  readonly contract = input.required<Contract | undefined>();
}
