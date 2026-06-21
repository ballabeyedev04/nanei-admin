import { api } from './axios';
import type { User } from '@/types';

export const adminsApi = {
  list: () => api.get<{ admins: User[] }>('/admin/liste-admins'),
  count: () => api.get<{ nombre: number }>('/admin/nombre-admins'),
  search: (q: string) => api.get<{ admins: User[] }>('/admin/rechercher-admin', { params: { q } }),
  create: (data: { nom: string; prenom: string; email: string; mot_de_passe: string; adresse?: string; telephone?: string }) =>
    api.post('/admin/ajouter-admin', data),
  activate: (id: string) => api.put(`/admin/activer-admin/${id}`),
  deactivate: (id: string) => api.put(`/admin/desactiver-admin/${id}`),
};
