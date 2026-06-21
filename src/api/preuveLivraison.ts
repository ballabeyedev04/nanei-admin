import { api } from './axios';
import type { PreuveLivraison } from '@/types';

export const preuveLivraisonApi = {
  get: (colisId: string) => api.get<{ data: PreuveLivraison }>(`/admin/colis/${colisId}/preuve`),
  upload: (colisId: string, formData: FormData) =>
    api.post(`/admin/colis/${colisId}/preuve`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};
