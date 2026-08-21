import { inject, Injectable } from '@angular/core';
import { Auth } from 'firebase/auth';
import { Functions, httpsCallable } from 'firebase/functions';
import { FirebaseStorage, ref, uploadBytes } from 'firebase/storage';

import {
  FIREBASE_AUTH,
  FIREBASE_FUNCTIONS,
  FIREBASE_STORAGE,
} from '../../../core/firebase/firebase.providers';
import { EvidenceFile } from '../../../shared/models';

export interface EvidenceUploadMetadata {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
}

const MAX_FILES = 10;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1920;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable({ providedIn: 'root' })
export class ReservationEvidenceService {
  private readonly auth = inject<Auth>(FIREBASE_AUTH);
  private readonly storage = inject<FirebaseStorage>(FIREBASE_STORAGE);
  private readonly functions = inject<Functions>(FIREBASE_FUNCTIONS);

  async uploadAndAttach(
    reservationId: string,
    files: File[],
    existingCount: number,
  ): Promise<EvidenceFile[]> {
    if (!files.length) {
      throw new Error('Seleccione al menos una imagen.');
    }
    if (existingCount + files.length > MAX_FILES) {
      throw new Error(`Cada reserva admite hasta ${MAX_FILES} evidencias.`);
    }
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('Debe iniciar sesión para subir evidencias.');
    }

    const metadata: EvidenceUploadMetadata[] = [];
    for (const file of files) {
      this.validateSource(file);
      const compressed = await this.compressImage(file);
      const uploadId = crypto.randomUUID();
      const safeName = this.safeFileName(
        `${file.name.replace(/\.[^.]+$/, '')}.webp`,
      );
      const storagePath = [
        'reservationEvidence',
        user.uid,
        reservationId,
        uploadId,
        safeName,
      ].join('/');
      await uploadBytes(ref(this.storage, storagePath), compressed, {
        contentType: compressed.type,
        customMetadata: { reservationId, uploadedByUid: user.uid },
      });
      metadata.push({
        storagePath,
        fileName: safeName,
        contentType: compressed.type,
        sizeBytes: compressed.size,
        uploadedAt: new Date().toISOString(),
      });
    }

    const callable = httpsCallable<
      { reservationId: string; files: EvidenceUploadMetadata[] },
      { files: EvidenceFile[]; message: string }
    >(this.functions, 'addReservationEvidence');
    const result = await callable({ reservationId, files: metadata });
    return result.data.files;
  }

  async getAccessUrl(
    reservationId: string,
    storagePath: string,
  ): Promise<string> {
    const callable = httpsCallable<
      { reservationId: string; storagePath: string },
      { url: string }
    >(this.functions, 'getReservationEvidenceAccess');
    const result = await callable({ reservationId, storagePath });
    return result.data.url;
  }

  private validateSource(file: File): void {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Use imágenes JPG, PNG o WebP.');
    }
  }

  private async compressImage(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('No fue posible comprimir la imagen.');
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    let quality = 0.84;
    let blob = await this.canvasToBlob(canvas, quality);
    while (blob.size > MAX_SIZE_BYTES && quality > 0.42) {
      quality -= 0.08;
      blob = await this.canvasToBlob(canvas, quality);
    }
    if (blob.size > MAX_SIZE_BYTES) {
      throw new Error('La imagen comprimida todavía supera 5 MB.');
    }
    return new File([blob], file.name, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('No fue posible comprimir la imagen.')),
        'image/webp',
        quality,
      );
    });
  }

  private safeFileName(name: string): string {
    return name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
  }
}
