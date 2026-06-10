import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type InfoCalloutVariant = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-info-callout',
  imports: [MatIconModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-info-callout" [ngClass]="variantClass()">
      @if (icon()) {
        <mat-icon class="mt-0.5 text-[20px]">{{ icon() }}</mat-icon>
      }

      <div class="min-w-0">
        @if (title()) {
          <p class="m-0 font-semibold">{{ title() }}</p>
        }

        @if (message()) {
          <p class="m-0 leading-6">{{ message() }}</p>
        } @else {
          <ng-content />
        }
      </div>
    </div>
  `,
})
export class AppInfoCalloutComponent {
  readonly variant = input<InfoCalloutVariant>('info');
  readonly icon = input<string>('info');
  readonly title = input<string>();
  readonly message = input<string>();

  protected variantClass(): string {
    return `app-info-callout--${this.variant()}`;
  }
}
