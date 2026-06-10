import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type StatusChipVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

@Component({
  selector: 'app-status-chip',
  imports: [MatIconModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="app-status-chip" [ngClass]="variantClass()">
      @if (icon()) {
        <mat-icon class="text-[18px]">{{ icon() }}</mat-icon>
      }

      @if (label()) {
        <span>{{ label() }}</span>
      } @else {
        <ng-content />
      }
    </span>
  `,
})
export class AppStatusChipComponent {
  readonly variant = input<StatusChipVariant>('neutral');
  readonly icon = input<string>();
  readonly label = input<string>();

  protected variantClass(): string {
    return `app-status-chip--${this.variant()}`;
  }
}
