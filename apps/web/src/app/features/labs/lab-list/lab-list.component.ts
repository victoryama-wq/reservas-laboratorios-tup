import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import {
  AppIconBoxComponent,
  AppStatusChipComponent,
} from '../../../shared/components';
import { LabDoc } from '../../../shared/models';
import { LabService } from '../services/lab.service';

type LabTypeFilter =
  | 'all'
  | 'health'
  | 'technology'
  | 'food'
  | 'legal'
  | 'architecture'
  | 'observation'
  | 'research';

type SortOrder = 'nameAsc' | 'nameDesc' | 'noticeAsc';

@Component({
  selector: 'app-lab-list',
  imports: [
    AppIconBoxComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    RouterLink,
  ],
  templateUrl: './lab-list.component.html',
  styleUrl: './lab-list.component.scss',
})
export class LabListComponent implements OnInit {
  private readonly labService = inject(LabService);

  protected readonly labs = signal<LabDoc[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly searchTerm = signal('');
  protected readonly typeFilter = signal<LabTypeFilter>('all');
  protected readonly sortOrder = signal<SortOrder>('nameAsc');

  protected readonly filteredLabs = computed(() => {
    const term = this.normalizeText(this.searchTerm().trim());
    const typeFilter = this.typeFilter();
    const sortOrder = this.sortOrder();

    return [...this.labs()]
      .filter((lab) => {
        const searchable = this.normalizeText(
          `${lab.name} ${lab.shortDescription} ${lab.description}`,
        );

        return !term || searchable.includes(term);
      })
      .filter((lab) => typeFilter === 'all' || this.labType(lab) === typeFilter)
      .sort((left, right) => {
        if (sortOrder === 'nameDesc') {
          return right.name.localeCompare(left.name, 'es');
        }

        if (sortOrder === 'noticeAsc') {
          return left.minNoticeHours - right.minNoticeHours;
        }

        return left.name.localeCompare(right.name, 'es');
      });
  });

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.typeFilter() !== 'all' ||
      this.sortOrder() !== 'nameAsc',
  );

  ngOnInit(): void {
    this.labService.listActiveVisibleLabs().subscribe({
      next: (labs) => {
        this.labs.set(labs);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No fue posible cargar el catalogo de laboratorios.',
        );
        this.loading.set(false);
      },
    });
  }

  protected scheduleSummary(lab: LabDoc): string {
    return this.labService.getWeeklyScheduleSummary(lab.weeklySchedule);
  }

  protected scheduleInline(lab: LabDoc): string {
    return this.scheduleSummary(lab)
      .replaceAll('. ', ' | ')
      .replace(/\.$/, '')
      .replace('Domingo cerrado', 'Dom cerrado');
  }

  protected minNoticeLabel(lab: LabDoc): string {
    return lab.minNoticeHours > 0
      ? `${lab.minNoticeHours} h de anticipacion`
      : 'Sin anticipacion minima';
  }

  protected setSearchTerm(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.searchTerm.set(input?.value ?? '');
  }

  protected setTypeFilter(value: LabTypeFilter): void {
    this.typeFilter.set(value);
  }

  protected setSortOrder(value: SortOrder): void {
    this.sortOrder.set(value);
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.typeFilter.set('all');
    this.sortOrder.set('nameAsc');
  }

  protected labIcon(lab: LabDoc): string {
    const name = this.normalizeText(lab.name);

    if (name.includes('computo')) {
      return 'desktop_windows';
    }

    if (name.includes('alimentos') || name.includes('bebidas')) {
      return 'restaurant';
    }

    if (name.includes('criminologia') || name.includes('criminalistica')) {
      return 'fingerprint';
    }

    if (name.includes('gesell')) {
      return 'groups';
    }

    if (name.includes('consultorio')) {
      return 'medical_services';
    }

    if (name.includes('fisioterapia')) {
      return 'spa';
    }

    if (name.includes('simulacion')) {
      return 'monitor_heart';
    }

    if (name.includes('quirofano')) {
      return 'science';
    }

    if (name.includes('juicios')) {
      return 'gavel';
    }

    if (name.includes('arquitectura')) {
      return 'architecture';
    }

    return 'science';
  }

  private labType(lab: LabDoc): LabTypeFilter {
    const name = this.normalizeText(lab.name);

    if (
      name.includes('consultorio') ||
      name.includes('fisioterapia') ||
      name.includes('simulacion') ||
      name.includes('quirofano')
    ) {
      return 'health';
    }

    if (name.includes('computo')) {
      return 'technology';
    }

    if (name.includes('alimentos') || name.includes('bebidas')) {
      return 'food';
    }

    if (name.includes('juicios')) {
      return 'legal';
    }

    if (name.includes('arquitectura')) {
      return 'architecture';
    }

    if (name.includes('gesell')) {
      return 'observation';
    }

    return 'research';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
