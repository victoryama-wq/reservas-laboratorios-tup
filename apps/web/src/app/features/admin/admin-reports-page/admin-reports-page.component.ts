import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../../shared/components/placeholder-page.component';

@Component({
  selector: 'app-admin-reports-page',
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Reportes"
      description="Reportes administrativos - pendiente de implementación."
    />
  `,
})
export class AdminReportsPageComponent {}
