import { Timestamp } from 'firebase/firestore';

export interface LabDoc {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  imageUrl?: string;
  gallery?: LabGalleryImage[];
  coverImageId?: string;
  qrConfig?: LabQrConfig;
  calendarId: string;
  calendarSharedWith?: string;
  location?: string;
  responsibleUids: string[];
  responsibleEmails: string[];
  defaultNotifyEmails: string[];
  active: boolean;
  visibleInCatalog: boolean;
  minNoticeHours: number;
  requiresApprovalWhenRisky: boolean;
  requiresProtocolWhenRisky: boolean;
  weeklySchedule: WeeklySchedule;
  specialRules: LabSpecialRule[];
  qrPath: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WeeklySchedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export type LabGalleryImageContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface LabGalleryImage {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: LabGalleryImageContentType;
  sizeBytes: number;
  alt?: string;
  caption?: string;
  order: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type LabQrFrameStyle = 'classic' | 'card' | 'minimal';

export type LabQrPrintSize = 'small' | 'medium' | 'large';

export interface LabQrConfig {
  title?: string;
  subtitle?: string;
  customLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  showLogo?: boolean;
  frameStyle?: LabQrFrameStyle;
  printSize?: LabQrPrintSize;
}

export interface LabSpecialRule {
  id: string;
  name: string;
  active: boolean;
  termStart?: string;
  termEnd?: string;
  daysOfWeek?: number[];
  blockedStart?: string;
  blockedEnd?: string;
  fullDayBlocked?: boolean;
  reason: string;
}
