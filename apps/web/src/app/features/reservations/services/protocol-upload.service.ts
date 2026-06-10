import { inject, Injectable } from '@angular/core';
import { Auth } from 'firebase/auth';
import {
  FirebaseStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

import {
  FIREBASE_AUTH,
  FIREBASE_STORAGE,
} from '../../../core/firebase/firebase.providers';

export interface ProtocolUploadMetadata {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUid: string;
  uploadedAt: string;
}

const MAX_PROTOCOL_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_PROTOCOL_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable({
  providedIn: 'root',
})
export class ProtocolUploadService {
  private readonly auth = inject<Auth>(FIREBASE_AUTH);
  private readonly storage = inject<FirebaseStorage>(FIREBASE_STORAGE);

  async uploadProtocolFile(file: File): Promise<ProtocolUploadMetadata> {
    this.validateFile(file);

    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('Debe iniciar sesion para cargar el protocolo.');
    }

    const uploadId = globalThis.crypto.randomUUID();
    const safeFileName = this.toSafeFileName(file.name);
    const storagePath = `protocolUploads/${user.uid}/${uploadId}/${safeFileName}`;
    const storageRef = ref(this.storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedByUid: user.uid,
        uploadId,
      },
    });

    return {
      storagePath,
      fileName: safeFileName,
      contentType: file.type,
      sizeBytes: file.size,
      uploadedByUid: user.uid,
      uploadedAt: new Date().toISOString(),
    };
  }

  validateFile(file: File): void {
    if (!ALLOWED_PROTOCOL_TYPES.includes(file.type)) {
      throw new Error(
        'Tipo de archivo no permitido. Use PDF, PNG, JPG, DOC o DOCX.',
      );
    }

    if (file.size > MAX_PROTOCOL_SIZE_BYTES) {
      throw new Error('El protocolo no debe exceder 20 MB.');
    }
  }

  private toSafeFileName(fileName: string): string {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
  }
}
