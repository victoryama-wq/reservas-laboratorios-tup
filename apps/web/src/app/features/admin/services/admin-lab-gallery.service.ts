import { inject, Injectable } from '@angular/core';
import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';

import { FIREBASE_STORAGE } from '../../../core/firebase/firebase.providers';
import {
  LabGalleryImage,
  LabGalleryImageContentType,
} from '../../../shared/models';

export const MAX_LAB_GALLERY_IMAGES = 8;
export const MAX_LAB_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const JPEG_MIME_VARIANTS = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
]);

export interface UploadLabImageParams {
  labId: string;
  file: File;
  order: number;
  onProgress?: (progress: number) => void;
}

@Injectable({
  providedIn: 'root',
})
export class AdminLabGalleryService {
  private readonly storage = inject<FirebaseStorage>(FIREBASE_STORAGE);

  validateImageFile(file: File): string | null {
    if (!this.normalizeImageContentType(file)) {
      return 'Solo se permiten imagenes JPG, PNG o WebP.';
    }

    if (file.size > MAX_LAB_IMAGE_SIZE_BYTES) {
      return 'La imagen no puede exceder 5 MB.';
    }

    return null;
  }

  async uploadLabImage(
    params: UploadLabImageParams,
  ): Promise<LabGalleryImage> {
    const validationError = this.validateImageFile(params.file);
    if (validationError) {
      throw new Error(validationError);
    }

    const contentType = this.normalizeImageContentType(params.file);
    if (!contentType) {
      throw new Error('Solo se permiten imagenes JPG, PNG o WebP.');
    }

    const imageId = this.createImageId();
    const fileName = this.sanitizeFileName(params.file.name);
    const storagePath =
      `labImages/${params.labId}/gallery/${imageId}/${fileName}`;
    const storageReference = ref(this.storage, storagePath);

    params.onProgress?.(0);
    await uploadBytes(storageReference, params.file, {
      contentType,
    });
    params.onProgress?.(100);

    return {
      id: imageId,
      storagePath,
      fileName,
      contentType,
      sizeBytes: params.file.size,
      order: params.order,
      active: true,
      createdAt: Timestamp.now(),
    };
  }

  async getPreviewUrl(storagePath: string): Promise<string> {
    return getDownloadURL(ref(this.storage, storagePath));
  }

  private normalizeImageContentType(
    file: File,
  ): LabGalleryImageContentType | null {
    const contentType = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (JPEG_MIME_VARIANTS.has(contentType) ||
      extension === 'jpg' ||
      extension === 'jpeg') {
      return 'image/jpeg';
    }

    if (contentType === 'image/png' || extension === 'png') {
      return 'image/png';
    }

    if (contentType === 'image/webp' || extension === 'webp') {
      return 'image/webp';
    }

    return null;
  }

  private createImageId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private sanitizeFileName(fileName: string): string {
    const normalized = fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'imagen-laboratorio';
  }
}
