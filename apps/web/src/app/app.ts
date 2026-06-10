import { Component } from '@angular/core';
import { AppShellComponent } from './core/layouts/app-shell/app-shell.component';

@Component({
  selector: 'app-root',
  imports: [AppShellComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
