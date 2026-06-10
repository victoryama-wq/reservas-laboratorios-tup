import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import {
  AppStatusChipComponent,
  StatusChipVariant,
} from '../app-status-chip/app-status-chip.component';

@Component({
  selector: 'app-page-header',
  imports: [AppStatusChipComponent, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="app-page-header">
      <div class="grid gap-3">
        @if (backLabel() && backLink()) {
          <a
            class="inline-flex w-fit items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"
            [routerLink]="backLink()"
          >
            <mat-icon class="text-[20px]">arrow_back</mat-icon>
            {{ backLabel() }}
          </a>
        }

        @if (kicker()) {
          <p class="app-page-kicker">{{ kicker() }}</p>
        }

        <div class="flex flex-wrap items-center gap-3">
          <h1 class="app-page-title">{{ title() }}</h1>

          @if (statusLabel()) {
            <app-status-chip
              [variant]="statusVariant()"
              [icon]="statusIcon()"
              [label]="statusLabel()"
            />
          }
        </div>

        @if (subtitle()) {
          <p class="app-page-subtitle">{{ subtitle() }}</p>
        }
      </div>

      <ng-content select="[page-actions]" />
    </header>
  `,
})
export class AppPageHeaderComponent {
  readonly kicker = input<string>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly backLabel = input<string>();
  readonly backLink = input<string>();
  readonly statusLabel = input<string>();
  readonly statusVariant = input<StatusChipVariant>('neutral');
  readonly statusIcon = input<string>();
}
