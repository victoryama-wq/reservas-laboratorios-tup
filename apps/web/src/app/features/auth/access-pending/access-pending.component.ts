import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-access-pending',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './access-pending.component.html',
  styleUrl: './access-pending.component.scss',
})
export class AccessPendingComponent {
  protected readonly accessDenied: boolean;

  constructor(route: ActivatedRoute) {
    this.accessDenied =
      route.snapshot.queryParamMap.get('status') === 'access-denied';
  }
}
