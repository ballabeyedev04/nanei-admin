import { api } from './axios';
import type { Rapport } from '@/types';

export const rapportsApi = {
  list: () => api.get<{ data: Rapport[] }>('/admin/rapports'),
  download: (filename: string) =>
    api.get(`/admin/rapports/${filename}`, { responseType: 'blob' }),
  generate: () => api.post('/admin/rapports/generer'),
};
