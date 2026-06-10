import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { LabDoc } from '../../../shared/models';
import {
  AppIconBoxComponent,
  AppPageHeaderComponent,
} from '../../../shared/components';
import { LabCalendarComponent } from '../../calendar/lab-calendar/lab-calendar.component';
import { LabService } from '../services/lab.service';

@Component({
  selector: 'app-lab-detail',
  imports: [
    AppIconBoxComponent,
    AppPageHeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LabCalendarComponent,
    RouterLink,
  ],
  templateUrl: './lab-detail.component.html',
  styleUrl: './lab-detail.component.scss',
})
export class LabDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly labService = inject(LabService);

  protected readonly lab = signal<LabDoc | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    const labId = this.route.snapshot.paramMap.get('labId');

    if (!labId) {
      this.errorMessage.set('No se recibio el identificador del laboratorio.');
      this.loading.set(false);
      return;
    }

    this.labService.getLabById(labId).subscribe({
      next: (lab) => {
        this.lab.set(lab);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar el laboratorio.');
        this.loading.set(false);
      },
    });
  }

  protected scheduleSummary(lab: LabDoc): string {
    return this.labService.getWeeklyScheduleSummary(lab.weeklySchedule);
  }

  protected minNoticeLabel(lab: LabDoc): string {
    return lab.minNoticeHours > 0
      ? `${lab.minNoticeHours} horas`
      : 'Sin anticipacion minima';
  }
}
