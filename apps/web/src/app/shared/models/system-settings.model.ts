import { Timestamp } from 'firebase/firestore';

export interface SystemSettingsDoc {
  institutionName: string;
  institutionalDomain: string;
  defaultNotifyEmails: string[];
  adminEmails: string[];
  termStart?: string;
  termEnd?: string;
  allowTeacherCancellation: boolean;
  cancellationMinHours?: number;
  maxProtocolFileSizeMb: number;
  allowedProtocolFileTypes: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
