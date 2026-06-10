import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  AppIconBoxComponent,
  AppSectionCardComponent,
  AppStatusChipComponent,
} from '../../../../shared/components';

@Component({
  selector: 'app-protocol-file-card',
  imports: [
    AppIconBoxComponent,
    AppSectionCardComponent,
    AppStatusChipComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './protocol-file-card.component.html',
  styleUrl: './protocol-file-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolFileCardComponent {
  readonly fileName = input<string>();
  readonly fileSize = input<string>();
  readonly fileType = input<string>();
  readonly downloadUrl = input<string | null>(null);
  readonly disabled = input(false);

  readonly download = output<void>();

  protected hasFile(): boolean {
    return Boolean(this.fileName()?.trim());
  }

  protected emitDownload(): void {
    this.download.emit();
  }
}
