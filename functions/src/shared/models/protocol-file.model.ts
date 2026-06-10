import {Timestamp} from "firebase-admin/firestore";

export interface ProtocolFile {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUid: string;
  downloadUrl?: string;
  uploadedAt: Timestamp;
}
