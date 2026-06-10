import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type IconBoxVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export type IconBoxSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-icon-box',
  imports: [MatIconModule, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="app-icon-box"
      [ngClass]="[variantClass(), sizeClass()]"
      aria-hidden="true"
    >
      <mat-icon class="app-icon-box__icon" [ngClass]="iconSizeClass()">
        {{ icon() }}
      </mat-icon>
    </span>
  `,
  styles: [`
    .app-icon-box {
      overflow: visible;
    }

    .app-icon-box__icon {
      display: grid;
      width: 1em !important;
      height: 1em !important;
      place-items: center;
      overflow: visible;
      line-height: 1;
    }
  `],
})
export class AppIconBoxComponent {
  readonly icon = input.required<string>();
  readonly variant = input<IconBoxVariant>('primary');
  readonly size = input<IconBoxSize>('md');

  protected variantClass(): string {
    const variants: Record<IconBoxVariant, string> = {
      primary: 'bg-violet-50 text-violet-700',
      success: 'bg-emerald-50 text-emerald-700',
      warning: 'bg-amber-50 text-amber-700',
      danger: 'bg-red-50 text-red-700',
      neutral: 'bg-slate-100 text-slate-700',
    };

    return variants[this.variant()];
  }

  protected sizeClass(): string {
    const sizes: Record<IconBoxSize, string> = {
      sm: 'h-10 w-10 rounded-xl',
      md: 'h-12 w-12 rounded-2xl',
      lg: 'h-14 w-14 rounded-2xl',
    };

    return sizes[this.size()];
  }

  protected iconSizeClass(): string {
    const sizes: Record<IconBoxSize, string> = {
      sm: 'text-[18px]',
      md: 'text-[22px]',
      lg: 'text-[26px]',
    };

    return sizes[this.size()];
  }
}
