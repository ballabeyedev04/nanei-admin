import { api } from './axios';
import type { AuditLog, Pagination } from '@/types';

/**
 * Paramètres lus par le back (`routes/admin/auditlog.route.js`) : noms en
 * snake_case. Dates au format AAAA-MM-JJ.
 */
export interface FiltresAudit {
  admin_id?: string;
  action?: string;
  entite?: string;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  limit?: number;
}

export const auditLogsApi = {
  list: (params?: FiltresAudit) =>
    api.get<{ success: boolean; logs: AuditLog[]; total: number; page: number; pages: number; pagination?: Pagination }>(
      '/admin/audit-logs',
      { params },
    ),
};
