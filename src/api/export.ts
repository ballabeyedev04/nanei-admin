import { api } from './axios';

export const exportApi = {
  colis: (format: 'csv' | 'xlsx', params?: Record<string, string>) =>
    api.get('/admin/export/colis', { params: { format, ...params }, responseType: 'blob' }),
  paiements: (format: 'csv' | 'xlsx', params?: Record<string, string>) =>
    api.get('/admin/export/paiements', { params: { format, ...params }, responseType: 'blob' }),
};
