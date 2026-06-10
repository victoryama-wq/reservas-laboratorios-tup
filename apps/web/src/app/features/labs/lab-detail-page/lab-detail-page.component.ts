import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../../shared/components/placeholder-page.component';

@Component({
  selector: 'app-lab-detail-page',
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Detalle de laboratorio"
      description="Pantalla de detalle de laboratorio - pendiente de implementación."
    />
  `,
})
export class LabDetailPageComponent {}
