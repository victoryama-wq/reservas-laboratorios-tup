import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LabGalleryViewImage } from '../../services/lab-gallery-view.service';

const AUTOPLAY_INTERVAL_MS = 5000;

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
export class LabImageCarouselComponent implements OnDestroy {
  readonly images = input<LabGalleryViewImage[]>([]);
  readonly labName = input.required<string>();
  readonly loading = input(false);
  readonly errorMessage = input('');

  protected readonly currentIndex = signal(0);
  protected readonly autoplayPausedByUser = signal(false);
  protected readonly autoplayAssistiveText = computed(() => {
    if (this.prefersReducedMotion()) {
      return 'Reproduccion automatica desactivada por preferencia de movimiento reducido.';
    }

    if (this.autoplayPausedByUser()) {
      return 'Reproduccion automatica pausada por interaccion del usuario.';
    }

    return 'La galeria cambia automaticamente cada 5 segundos.';
  });
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
  private readonly hoverPaused = signal(false);
  private readonly focusPaused = signal(false);
  private readonly prefersReducedMotion = signal(this.getInitialReducedMotion());
  private readonly autoplayPaused = computed(() =>
    this.loading()
      || this.images().length < 2
      || this.hoverPaused()
      || this.focusPaused()
      || this.autoplayPausedByUser()
      || this.prefersReducedMotion(),
  );
  private autoplayTimer: number | null = null;
  private motionQuery: MediaQueryList | null = null;

  constructor() {
    this.configureMotionPreferenceListener();

    effect(() => {
      const shouldPause = this.autoplayPaused();
      const imageCount = this.images().length;
      this.stopAutoplay();

      if (!shouldPause && imageCount > 1 && typeof window !== 'undefined') {
        this.autoplayTimer = window.setInterval(() => {
          this.goToNext(true);
        }, AUTOPLAY_INTERVAL_MS);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
    this.motionQuery?.removeEventListener(
      'change',
      this.handleMotionPreferenceChange,
    );
  }

  protected pauseAutoplayOnHover(): void {
    this.hoverPaused.set(true);
  }

  protected resumeAutoplayOnHover(): void {
    this.hoverPaused.set(false);
  }

  protected pauseAutoplayOnFocus(): void {
    this.focusPaused.set(true);
  }

  protected resumeAutoplayOnFocus(): void {
    this.focusPaused.set(false);
  }

  protected goToPrevious(fromAutoplay = false): void {
    const imageCount = this.images().length;
    if (imageCount < 2) {
      return;
    }

    this.pauseIfUserAction(fromAutoplay);
    this.currentIndex.update((current) =>
      current === 0 ? imageCount - 1 : current - 1,
    );
  }

  protected goToNext(fromAutoplay = false): void {
    const imageCount = this.images().length;
    if (imageCount < 2) {
      return;
    }

    this.pauseIfUserAction(fromAutoplay);
    this.currentIndex.update((current) =>
      current >= imageCount - 1 ? 0 : current + 1,
    );
  }

  protected goToImage(index: number): void {
    this.autoplayPausedByUser.set(true);
    this.currentIndex.set(index);
  }

  private pauseIfUserAction(fromAutoplay: boolean): void {
    if (!fromAutoplay) {
      this.autoplayPausedByUser.set(true);
    }
  }

  private stopAutoplay(): void {
    if (this.autoplayTimer !== null) {
      window.clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  private getInitialReducedMotion(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private configureMotionPreferenceListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.prefersReducedMotion.set(this.motionQuery.matches);
    this.motionQuery.addEventListener(
      'change',
      this.handleMotionPreferenceChange,
    );
  }

  private readonly handleMotionPreferenceChange = (
    event: MediaQueryListEvent,
  ): void => {
    this.prefersReducedMotion.set(event.matches);
  };
}
