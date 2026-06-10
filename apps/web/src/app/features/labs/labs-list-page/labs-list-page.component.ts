import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../../shared/components/placeholder-page.component';

@Component({
  selector: 'app-labs-list-page',
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Laboratorios"
      description="Pantalla de laboratorios - pendiente de implementación."
    />
  `,
})
export class LabsListPageComponent {}
