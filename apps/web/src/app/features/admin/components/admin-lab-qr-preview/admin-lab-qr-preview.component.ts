import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as QRCode from 'qrcode';

import { AppInfoCalloutComponent } from '../../../../shared/components';
import {
  LabQrConfig,
  LabQrFrameStyle,
  LabQrPrintSize,
} from '../../../../shared/models';

const RESERVATION_BASE_URL = 'https://reservas-laboratorios-tup.web.app/reservar';

const DEFAULT_QR_CONFIG: Required<LabQrConfig> = {
  title: 'Reserva de laboratorio',
  subtitle: 'Escanea para solicitar este espacio academico.',
  customLabel: 'Sistema Web de Reservas de Laboratorios',
  primaryColor: '#271e5d',
  secondaryColor: '#252a86',
  backgroundColor: '#ffffff',
  showLogo: true,
  frameStyle: 'card',
  printSize: 'medium',
};

@Component({
  selector: 'app-admin-lab-qr-preview',
  imports: [
    AppInfoCalloutComponent,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './admin-lab-qr-preview.component.html',
  styleUrl: './admin-lab-qr-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLabQrPreviewComponent {
  readonly labName = input.required<string>();
  readonly slug = input.required<string>();
  readonly qrConfig = input<LabQrConfig | null | undefined>(undefined);

  protected readonly qrDataUrl = signal('');
  protected readonly qrSvg = signal('');
  protected readonly renderError = signal('');

  protected readonly normalizedConfig = computed<Required<LabQrConfig>>(() => ({
    ...DEFAULT_QR_CONFIG,
    ...(this.qrConfig() ?? {}),
  }));

  protected readonly qrUrl = computed(() => {
    const slug = this.slug().trim();
    return slug ? `${RESERVATION_BASE_URL}/${slug}` : RESERVATION_BASE_URL;
  });

  protected readonly contrastIsLow = computed(() => {
    const config = this.normalizedConfig();
    return contrastRatio(config.primaryColor, config.backgroundColor) < 3;
  });

  private renderToken = 0;
  private readonly snackBar = inject(MatSnackBar);

  constructor() {
    effect(() => {
      const url = this.qrUrl();
      const config = this.normalizedConfig();
      void this.renderQr(url, config);
    });
  }

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.qrUrl());
      this.snackBar.open('Enlace QR copiado.', 'Cerrar', {
        duration: 3000,
        panelClass: ['app-snackbar-success'],
      });
    } catch {
      this.snackBar.open('No fue posible copiar el enlace.', 'Cerrar', {
        duration: 3500,
        panelClass: ['app-snackbar-danger'],
      });
    }
  }

  protected async downloadPng(): Promise<void> {
    const dataUrl = await this.renderPrintablePng();
    if (!dataUrl) {
      return;
    }

    this.downloadDataUrl(dataUrl, `qr-${this.safeSlug()}.png`);
  }

  protected downloadSvg(): void {
    const svg = this.qrSvg();
    if (!svg) {
      this.snackBar.open('El QR aun no esta listo para descargar.', 'Cerrar', {
        duration: 3500,
        panelClass: ['app-snackbar-warning'],
      });
      return;
    }

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    this.downloadDataUrl(url, `qr-${this.safeSlug()}.svg`);
    URL.revokeObjectURL(url);
  }

  protected async printQr(): Promise<void> {
    const dataUrl = await this.renderPrintablePng();
    if (!dataUrl) {
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      this.snackBar.open('Permita ventanas emergentes para imprimir el QR.', 'Cerrar', {
        duration: 4500,
        panelClass: ['app-snackbar-warning'],
      });
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>QR ${escapeHtml(this.labName())}</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f8fafc;
              font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            img {
              width: min(92vw, 640px);
              height: auto;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="QR para reservar ${escapeHtml(this.labName())}">
          <script>
            window.addEventListener('load', () => {
              window.print();
              window.close();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  private async renderQr(
    url: string,
    config: Required<LabQrConfig>,
  ): Promise<void> {
    const token = ++this.renderToken;
    this.renderError.set('');

    try {
      const options = {
        errorCorrectionLevel: 'H' as const,
        margin: 2,
        width: 320,
        color: {
          dark: config.primaryColor,
          light: config.backgroundColor,
        },
      };
      const [dataUrl, svg] = await Promise.all([
        QRCode.toDataURL(url, options),
        QRCode.toString(url, { ...options, type: 'svg' as const }),
      ]);

      if (token === this.renderToken) {
        this.qrDataUrl.set(dataUrl);
        this.qrSvg.set(svg);
      }
    } catch {
      if (token === this.renderToken) {
        this.qrDataUrl.set('');
        this.qrSvg.set('');
        this.renderError.set('No fue posible generar la previsualizacion del QR.');
      }
    }
  }

  private async renderPrintablePng(): Promise<string> {
    const qrDataUrl = this.qrDataUrl();
    if (!qrDataUrl) {
      this.snackBar.open('El QR aun no esta listo para descargar.', 'Cerrar', {
        duration: 3500,
        panelClass: ['app-snackbar-warning'],
      });
      return '';
    }

    const config = this.normalizedConfig();
    const size = canvasSize(config.printSize);
    const canvas = document.createElement('canvas');
    const scale = window.devicePixelRatio || 1;
    canvas.width = size.width * scale;
    canvas.height = size.height * scale;

    const context = canvas.getContext('2d');
    if (!context) {
      return '';
    }

    context.scale(scale, scale);
    context.fillStyle = config.backgroundColor;
    roundRect(context, 0, 0, size.width, size.height, 28);
    context.fill();

    context.fillStyle = config.primaryColor;
    context.fillRect(0, 0, size.width, 18);

    if (config.showLogo) {
      drawBadge(context, size.width / 2 - 42, 48, 84, 84, config);
    }

    context.textAlign = 'center';
    context.fillStyle = '#111827';
    context.font = '700 38px Inter, system-ui, sans-serif';
    wrapText(context, config.title || this.labName(), size.width / 2, 170, size.width - 96, 42);

    context.fillStyle = '#4B5563';
    context.font = '500 22px Inter, system-ui, sans-serif';
    wrapText(context, this.labName(), size.width / 2, 260, size.width - 96, 30);

    const qrImage = await loadImage(qrDataUrl);
    const qrSize = Math.min(size.width - 180, 430);
    const qrX = (size.width - qrSize) / 2;
    const qrY = 310;
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    context.fillStyle = config.secondaryColor;
    context.font = '700 20px Inter, system-ui, sans-serif';
    wrapText(context, config.subtitle, size.width / 2, qrY + qrSize + 56, size.width - 96, 30);

    context.fillStyle = '#6B7280';
    context.font = '500 17px Inter, system-ui, sans-serif';
    wrapText(context, this.qrUrl(), size.width / 2, size.height - 100, size.width - 96, 24);

    context.fillStyle = config.primaryColor;
    context.font = '700 16px Inter, system-ui, sans-serif';
    wrapText(context, config.customLabel, size.width / 2, size.height - 48, size.width - 96, 22);

    return canvas.toDataURL('image/png');
  }

  private downloadDataUrl(dataUrl: string, fileName: string): void {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.click();
  }

  private safeSlug(): string {
    return this.slug().trim() || 'laboratorio';
  }
}

function canvasSize(printSize: LabQrPrintSize): { width: number; height: number } {
  if (printSize === 'small') {
    return { width: 720, height: 1000 };
  }

  if (printSize === 'large') {
    return { width: 1080, height: 1500 };
  }

  return { width: 900, height: 1260 };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No fue posible cargar la imagen QR.'));
    image.src = src;
  });
}

function drawBadge(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  config: Required<LabQrConfig>,
): void {
  context.fillStyle = config.primaryColor;
  roundRect(context, x, y, width, height, 18);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = '800 24px Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('TUP', x + width / 2, y + height / 2);
  context.textBaseline = 'alphabetic';
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    context.fillText(line, x, currentY);
  }
}

function contrastRatio(firstHex: string, secondHex: string): number {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) {
    return 0;
  }

  const channels = [0, 2, 4].map((start) =>
    parseInt(normalized.slice(start, start + 2), 16) / 255,
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
