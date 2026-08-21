import {Timestamp} from "firebase-admin/firestore";

export interface EvidenceFile {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUid: string;
  uploadedAt: Timestamp;
  expiresAt: Timestamp;
}
