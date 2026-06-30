import { Component, input, model } from '@angular/core';

/** Switch on/off que revela (o atenúa) el contenido proyectado. */
@Component({
  selector: 'app-toggle-section',
  standalone: true,
  template: `
    <div class="flex flex-col gap-stack-md">
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            class="sr-only peer"
            [checked]="active()"
            (change)="active.set($any($event.target).checked)">
          <div class="w-11 h-6 bg-surface-variant rounded-full peer relative
            peer-checked:bg-primary
            after:content-[''] after:absolute after:top-[2px] after:start-[2px]
            after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5
            after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
          <span class="font-title-md text-title-md text-on-surface">{{ label() }}</span>
        </label>
      </div>
      <div
        class="flex flex-col gap-stack-md transition-opacity"
        [class.opacity-50]="!active()"
        [class.pointer-events-none]="!active()">
        <ng-content />
      </div>
    </div>
  `
})
export class ToggleSectionComponent {
  readonly label = input.required<string>();
  readonly active = model(false);
}
