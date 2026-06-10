import { Timestamp } from 'firebase/firestore';

export type AuditEventType =
  | 'ADMIN_ACTION'
  | 'SENSITIVE_CHANGE'
  | 'TECHNICAL_ERROR'
  | 'CALENDAR_ERROR'
  | 'EMAIL_ERROR'
  | 'SECURITY_EVENT';

export interface AuditEventDoc {
  id: string;
  type: AuditEventType;
  actorUid?: string;
  actorEmail?: string;
  targetCollection?: string;
  targetId?: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}
