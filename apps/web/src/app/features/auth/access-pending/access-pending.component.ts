import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-access-pending',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './access-pending.component.html',
  styleUrl: './access-pending.component.scss',
})
export class AccessPendingComponent {}
