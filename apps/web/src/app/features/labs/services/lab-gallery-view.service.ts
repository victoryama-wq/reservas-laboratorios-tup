import { Injectable } from '@angular/core';

import { PublicLabGalleryImage } from '../../../shared/models';

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
  async resolveGalleryImages(
    gallery: PublicLabGalleryImage[] | undefined,
    coverImageId: string | undefined,
    labName: string,
  ): Promise<LabGalleryViewImage[]> {
    return (gallery ?? [])
      .filter((image) => image.active && Boolean(image.url))
      .sort((first, second) => {
        const firstIsCover = first.id === coverImageId;
        const secondIsCover = second.id === coverImageId;

        if (firstIsCover !== secondIsCover) {
          return firstIsCover ? -1 : 1;
        }

        return first.order - second.order;
      })
      .map((image) => ({
        id: image.id,
        src: image.url as string,
        alt: image.alt || `Imagen del laboratorio ${labName}`,
        caption: image.caption,
        order: image.order,
        isCover: image.id === coverImageId,
      }));
  }
}
