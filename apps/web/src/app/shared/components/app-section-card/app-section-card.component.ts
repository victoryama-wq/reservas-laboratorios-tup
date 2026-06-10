import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import {
  AppIconBoxComponent,
  IconBoxVariant,
} from '../app-icon-box/app-icon-box.component';

@Component({
  selector: 'app-section-card',
  imports: [AppIconBoxComponent, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="app-section-card" [ngClass]="{ 'app-section-card--unpadded': !padded() }">
      @if (title() || subtitle() || icon()) {
        <header class="app-section-card-header">
          @if (icon()) {
            <app-icon-box [icon]="icon()!" [variant]="iconVariant()" />
          }

          <div class="min-w-0">
            @if (title()) {
              <h2 class="app-section-card-title">{{ title() }}</h2>
            }

            @if (subtitle()) {
              <p class="m-0 mt-1 text-sm leading-6 text-slate-600">
                {{ subtitle() }}
              </p>
            }
          </div>
        </header>
      }

      <ng-content />
    </section>
  `,
})
export class AppSectionCardComponent {
  readonly title = input<string>();
  readonly subtitle = input<string>();
  readonly icon = input<string>();
  readonly iconVariant = input<IconBoxVariant>('primary');
  readonly padded = input(true);
}
