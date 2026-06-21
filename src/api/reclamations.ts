import { api } from './axios';
import type { Reclamation, StatutReclamation } from '@/types';

export const reclamationsApi = {
  list: (statut?: string) =>
    api.get<{ data: Reclamation[] }>('/admin/reclamations', { params: statut ? { statut } : undefined }),
  update: (id: string, statut: StatutReclamation, commentaire?: string) =>
    api.put(`/admin/reclamations/${id}`, { statut, commentaire }),
};
