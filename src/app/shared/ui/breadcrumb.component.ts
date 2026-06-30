import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface BreadcrumbItem {
  label: string;
  link?: string | unknown[];
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <nav aria-label="Breadcrumb" class="flex text-on-surface-variant font-label-sm text-label-sm">
      <ol class="inline-flex items-center space-x-1 md:space-x-2">
        @for (item of items(); track $index; let last = $last; let first = $first) {
          <li class="inline-flex items-center">
            @if (!first) {
              <mat-icon class="text-[16px] flex items-center justify-center mx-1">chevron_right</mat-icon>
            }
            @if (item.link && !last) {
              <a [routerLink]="item.link" class="hover:text-primary transition-colors">{{ item.label }}</a>
            } @else {
              <span [class.text-primary]="last" [class.font-bold]="last">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `
})
export class BreadcrumbComponent {
  readonly items = input.required<BreadcrumbItem[]>();
}
