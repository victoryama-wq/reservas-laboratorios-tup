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
        <mat-icon class="app-status-chip__icon text-[18px]">
          {{ icon() }}
        </mat-icon>
      }

      @if (label()) {
        <span>{{ label() }}</span>
      } @else {
        <ng-content />
      }
    </span>
  `,
  styles: [`
    .app-status-chip__icon {
      display: inline-flex;
      width: 20px;
      min-width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      overflow: visible;
      line-height: 20px;
    }
  `],
})
export class AppStatusChipComponent {
  readonly variant = input<StatusChipVariant>('neutral');
  readonly icon = input<string>();
  readonly label = input<string>();

  protected variantClass(): string {
    return `app-status-chip--${this.variant()}`;
  }
}
