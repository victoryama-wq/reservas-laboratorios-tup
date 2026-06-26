import { inject, Injectable } from '@angular/core';
import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';

import { FIREBASE_STORAGE } from '../../../core/firebase/firebase.providers';
import {
  LabGalleryImage,
  LabGalleryImageContentType,
} from '../../../shared/models';

export const MAX_LAB_GALLERY_IMAGES = 8;
export const MAX_LAB_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_LAB_IMAGE_TYPES: LabGalleryImageContentType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

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
    if (!ALLOWED_LAB_IMAGE_TYPES.includes(
      file.type as LabGalleryImageContentType,
    )) {
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

    const imageId = this.createImageId();
    const fileName = this.sanitizeFileName(params.file.name);
    const storagePath =
      `labImages/${params.labId}/gallery/${imageId}/${fileName}`;
    const storageReference = ref(this.storage, storagePath);
    const uploadTask = uploadBytesResumable(storageReference, params.file, {
      contentType: params.file.type,
    });

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.totalBytes > 0 ?
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) :
            0;
          params.onProgress?.(progress);
        },
        reject,
        () => resolve(),
      );
    });

    return {
      id: imageId,
      storagePath,
      fileName,
      contentType: params.file.type as LabGalleryImageContentType,
      sizeBytes: params.file.size,
      order: params.order,
      active: true,
      createdAt: Timestamp.now(),
    };
  }

  async getPreviewUrl(storagePath: string): Promise<string> {
    return getDownloadURL(ref(this.storage, storagePath));
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
