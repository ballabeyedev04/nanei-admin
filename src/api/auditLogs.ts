import { api } from './axios';
import type { AuditLog } from '@/types';

export const auditLogsApi = {
  list: (params?: { admin?: string; action?: string; dateDebut?: string; dateFin?: string; page?: number }) =>
    api.get<{ data: AuditLog[]; total: number; page: number; pages: number }>('/admin/audit-logs', { params }),
};
