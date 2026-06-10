import { Component, input } from '@angular/core';

@Component({
  selector: 'app-placeholder-page',
  template: `
    <section class="placeholder-page">
      <p class="eyebrow">Fase base</p>
      <h1>{{ title() }}</h1>
      <p>{{ description() }}</p>
    </section>
  `,
  styles: [`
    .placeholder-page {
      display: grid;
      gap: 12px;
      min-height: 320px;
      align-content: center;
      padding: 32px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      background: #ffffff;
      box-shadow: var(--shadow-card);
    }

    .eyebrow {
      margin: 0;
      color: var(--color-accent);
      font-size: 0.78rem;
      font-weight: 850;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      color: var(--color-text-primary);
      font-size: clamp(1.45rem, 4vw, 2.1rem);
      font-weight: 850;
      line-height: 1.15;
    }

    p {
      max-width: 680px;
      margin: 0;
      color: var(--color-text-secondary);
      font-size: 1rem;
      line-height: 1.6;
    }
  `],
})
export class PlaceholderPageComponent {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
