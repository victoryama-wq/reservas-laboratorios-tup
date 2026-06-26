import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LabGalleryViewImage } from '../../services/lab-gallery-view.service';

@Component({
  selector: 'app-lab-image-carousel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './lab-image-carousel.component.html',
  styleUrl: './lab-image-carousel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabImageCarouselComponent {
  readonly images = input<LabGalleryViewImage[]>([]);
  readonly labName = input.required<string>();
  readonly loading = input(false);
  readonly errorMessage = input('');

  protected readonly currentIndex = signal(0);
  protected readonly hasImages = computed(() => this.images().length > 0);
  protected readonly activeIndex = computed(() => {
    const imageCount = this.images().length;
    if (imageCount === 0) {
      return 0;
    }

    return Math.min(this.currentIndex(), imageCount - 1);
  });
  protected readonly currentImage = computed(() =>
    this.images()[this.activeIndex()] ?? null,
  );
  protected readonly showControls = computed(() => this.images().length > 1);

  protected goToPrevious(): void {
    const imageCount = this.images().length;
    if (imageCount < 2) {
      return;
    }

    this.currentIndex.update((current) =>
      current === 0 ? imageCount - 1 : current - 1,
    );
  }

  protected goToNext(): void {
    const imageCount = this.images().length;
    if (imageCount < 2) {
      return;
    }

    this.currentIndex.update((current) =>
      current >= imageCount - 1 ? 0 : current + 1,
    );
  }

  protected goToImage(index: number): void {
    this.currentIndex.set(index);
  }
}
