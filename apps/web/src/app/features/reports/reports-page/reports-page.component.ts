import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import {
  AppInfoCalloutComponent,
  AppPageHeaderComponent,
  AppSectionCardComponent,
} from '../../../shared/components';
import { LabUsageChartComponent } from '../components/lab-usage-chart/lab-usage-chart.component';
import {
  GetLabUsageReportInput,
  GetLabUsageReportOutput,
  MonthlyLabUsage,
} from '../models/lab-usage-report.model';
import { LabUsageReportService } from '../services/lab-usage-report.service';

interface MonthOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-reports-page',
  imports: [
    AppInfoCalloutComponent,
    AppPageHeaderComponent,
    AppSectionCardComponent,
    LabUsageChartComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reportService = inject(LabUsageReportService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected readonly currentYear = this.institutionalYear();
  protected readonly years = Array.from(
    { length: this.currentYear - 2019 },
    (_, index) => this.currentYear - index,
  );
  protected readonly months: MonthOption[] = Array.from(
    { length: 12 },
    (_, index) => ({
      value: index + 1,
      label: this.monthLabel(index + 1),
    }),
  );
  protected readonly filterForm = this.formBuilder.nonNullable.group({
    year: this.currentYear,
    monthFrom: 1,
    monthTo: 12,
    labId: 'all',
  });

  protected report: GetLabUsageReportOutput | null = null;
  protected loading = true;
  protected errorMessage = '';

  async ngOnInit(): Promise<void> {
    await this.loadReport();
  }

  protected async applyFilters(): Promise<void> {
    await this.loadReport();
  }

  protected async clearFilters(): Promise<void> {
    this.filterForm.reset({
      year: this.currentYear,
      monthFrom: 1,
      monthTo: 12,
      labId: 'all',
    });
    await this.loadReport();
  }

  protected hasUsage(): boolean {
    return (this.report?.summary.confirmedReservations ?? 0) > 0;
  }

  protected isResponsibleWithoutLabs(): boolean {
    return (
      this.report?.scope.role === 'responsable_laboratorio' &&
      this.report.authorizedLabs.length === 0
    );
  }

  protected formatNumber(value: number, maximumFractionDigits = 0): string {
    return new Intl.NumberFormat('es-MX', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(value);
  }

  protected monthUsageLabel(item: MonthlyLabUsage): string {
    return `${this.monthLabel(item.month)} ${item.year}`;
  }

  private async loadReport(): Promise<void> {
    const { year, monthFrom, monthTo, labId } = this.filterForm.getRawValue();

    if (monthFrom > monthTo) {
      this.errorMessage = 'El mes inicial no puede ser posterior al mes final.';
      this.changeDetector.markForCheck();
      return;
    }

    const input: GetLabUsageReportInput = { year, monthFrom, monthTo };
    if (labId !== 'all') {
      input.labIds = [labId];
    }

    this.loading = true;
    this.errorMessage = '';
    this.changeDetector.markForCheck();

    try {
      this.report = await this.reportService.getUsageReport(input);
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No fue posible generar el reporte.';
    } finally {
      this.loading = false;
      this.changeDetector.detectChanges();
    }
  }

  private monthLabel(month: number): string {
    const label = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(
      new Date(2026, month - 1, 1),
    );
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  private institutionalYear(): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Cancun',
      year: 'numeric',
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === 'year')?.value);
  }
}
