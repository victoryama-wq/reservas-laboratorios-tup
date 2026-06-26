import { inject, Injectable } from '@angular/core';
import { FirebaseStorage, getDownloadURL, ref } from 'firebase/storage';

import { FIREBASE_STORAGE } from '../../../core/firebase/firebase.providers';
import { LabGalleryImage } from '../../../shared/models';

export interface LabGalleryViewImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  order: number;
  isCover: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LabGalleryViewService {
  private readonly storage = inject<FirebaseStorage>(FIREBASE_STORAGE);

  async resolveGalleryImages(
    gallery: LabGalleryImage[] | undefined,
    coverImageId: string | undefined,
    labName: string,
  ): Promise<LabGalleryViewImage[]> {
    const activeImages = (gallery ?? [])
      .filter((image) => image.active)
      .sort((first, second) => {
        const firstIsCover = first.id === coverImageId;
        const secondIsCover = second.id === coverImageId;

        if (firstIsCover !== secondIsCover) {
          return firstIsCover ? -1 : 1;
        }

        return first.order - second.order;
      });

    const results = await Promise.allSettled(
      activeImages.map(async (image) => {
        const src = await getDownloadURL(ref(this.storage, image.storagePath));
        return {
          id: image.id,
          src,
          alt: image.alt || `Imagen del laboratorio ${labName}`,
          caption: image.caption,
          order: image.order,
          isCover: image.id === coverImageId,
        } satisfies LabGalleryViewImage;
      }),
    );

    return results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
  }
}
