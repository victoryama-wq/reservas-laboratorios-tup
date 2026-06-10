import { Component } from '@angular/core';
import { PlaceholderPageComponent } from '../../../shared/components/placeholder-page.component';

@Component({
  selector: 'app-admin-rules-page',
  imports: [PlaceholderPageComponent],
  template: `
    <app-placeholder-page
      title="Administrar reglas"
      description="Gestión de reglas institucionales - pendiente de implementación."
    />
  `,
})
export class AdminRulesPageComponent {}
