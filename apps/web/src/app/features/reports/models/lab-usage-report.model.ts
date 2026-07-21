export type ReportRole = 'responsable_laboratorio' | 'admin_sistemas';

export interface GetLabUsageReportInput {
  year?: number;
  monthFrom?: number;
  monthTo?: number;
  labIds?: string[];
}

export interface ReportLabOption {
  id: string;
  name: string;
}

export interface MonthlyLabUsage {
  year: number;
  month: number;
  reservations: number;
  reservedHours: number;
}

export interface LabUsageSummary {
  labId: string;
  labName: string;
  reservations: number;
  reservedHours: number;
}

export interface GetLabUsageReportOutput {
  scope: {
    year: number;
    monthFrom: number;
    monthTo: number;
    role: ReportRole;
    selectedLabIds: string[];
  };
  summary: {
    confirmedReservations: number;
    totalReservedHours: number;
    averageReservationHours: number;
    mostUsedLabId?: string;
    mostUsedLabName?: string;
    mostUsedLabReservations?: number;
  };
  monthlyUsage: MonthlyLabUsage[];
  usageByLab: LabUsageSummary[];
  authorizedLabs: ReportLabOption[];
}
