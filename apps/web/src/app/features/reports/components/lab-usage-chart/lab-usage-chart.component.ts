import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Chart,
  ChartConfiguration,
  ChartType,
  registerables,
} from 'chart.js';

import { GetLabUsageReportOutput } from '../../models/lab-usage-report.model';

export type LabUsageChartKind =
  | 'monthly-reservations'
  | 'monthly-hours'
  | 'lab-usage';

Chart.register(...registerables);

@Component({
  selector: 'app-lab-usage-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-usage-chart.component.html',
  styleUrl: './lab-usage-chart.component.scss',
})
export class LabUsageChartComponent {
  readonly report = input.required<GetLabUsageReportOutput>();
  readonly kind = input.required<LabUsageChartKind>();
  readonly ariaLabel = input.required<string>();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const canvas = this.canvas();
      const report = this.report();
      const kind = this.kind();

      if (!canvas || !isPlatformBrowser(this.platformId)) {
        return;
      }

      this.chart?.destroy();
      this.chart = new Chart(
        canvas.nativeElement,
        this.buildConfiguration(report, kind),
      );
    });

    this.destroyRef.onDestroy(() => this.chart?.destroy());
  }

  private buildConfiguration(
    report: GetLabUsageReportOutput,
    kind: LabUsageChartKind,
  ): ChartConfiguration {
    if (kind === 'lab-usage') {
      return this.buildLabUsageConfiguration(report);
    }

    const labels = report.monthlyUsage.map((item) =>
      this.monthLabel(item.month, 'short'),
    );
    const values = report.monthlyUsage.map((item) =>
      kind === 'monthly-hours' ? item.reservedHours : item.reservations,
    );
    const isHours = kind === 'monthly-hours';

    return {
      type: isHours ? 'line' : 'bar',
      data: {
        labels,
        datasets: [
          {
            label: isHours ? 'Horas reservadas' : 'Reservas confirmadas',
            data: values,
            backgroundColor: isHours
              ? 'rgba(91, 33, 182, 0.12)'
              : 'rgba(91, 33, 182, 0.78)',
            borderColor: '#5B21B6',
            borderWidth: 2,
            borderRadius: isHours ? 0 : 8,
            fill: isHours,
            tension: 0.3,
            pointBackgroundColor: '#21005D',
            pointRadius: isHours ? 4 : 0,
          },
        ],
      },
      options: this.baseOptions(
        isHours ? 'Horas' : 'Reservas',
        false,
        (index) => {
          const item = report.monthlyUsage[index];
          return item
            ? `${item.reservations} reservas · ${this.hoursLabel(item.reservedHours)}`
            : '';
        },
        (index) => {
          const item = report.monthlyUsage[index];
          return item
            ? `${this.monthLabel(item.month, 'long')} de ${item.year}`
            : '';
        },
      ),
    };
  }

  private buildLabUsageConfiguration(
    report: GetLabUsageReportOutput,
  ): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels: report.usageByLab.map((item) => item.labName),
        datasets: [
          {
            label: 'Reservas confirmadas',
            data: report.usageByLab.map((item) => item.reservations),
            backgroundColor: 'rgba(37, 42, 134, 0.78)',
            borderColor: '#252A86',
            borderWidth: 1,
            borderRadius: 8,
          },
        ],
      },
      options: this.baseOptions(
        'Reservas',
        true,
        (index) => {
          const item = report.usageByLab[index];
          return item ? this.hoursLabel(item.reservedHours) : '';
        },
      ),
    };
  }

  private baseOptions(
    axisTitle: string,
    horizontal: boolean,
    footer: (index: number) => string,
    title?: (index: number) => string,
  ): NonNullable<ChartConfiguration<ChartType>['options']> {
    const reducedMotion =
      isPlatformBrowser(this.platformId) &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      animation: reducedMotion ? false : { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: title
              ? (items) => title(items[0]?.dataIndex ?? 0)
              : undefined,
            footer: (items) => footer(items[0]?.dataIndex ?? 0),
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.7)' },
          title: {
            display: horizontal,
            text: axisTitle,
            color: '#4B5563',
          },
          ticks: { color: '#4B5563', precision: 0 },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(226, 232, 240, 0.7)' },
          title: {
            display: !horizontal,
            text: axisTitle,
            color: '#4B5563',
          },
          ticks: { color: '#4B5563', precision: 0 },
        },
      },
    };
  }

  private monthLabel(month: number, format: 'short' | 'long'): string {
    return new Intl.DateTimeFormat('es-MX', { month: format }).format(
      new Date(2026, month - 1, 1),
    );
  }

  private hoursLabel(hours: number): string {
    return `${new Intl.NumberFormat('es-MX', {
      maximumFractionDigits: 2,
    }).format(hours)} horas`;
  }
}
