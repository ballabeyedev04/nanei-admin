import { api } from './axios';
import type { User } from '@/types';

export const clientsApi = {
  list: () => api.get<{ utilisateurs: User[] }>('/admin/liste-utilisateurs'),
  count: () => api.get<{ nombre: number }>('/admin/nombre-utilisateurs'),
  search: (q: string) => api.get<{ utilisateurs: User[] }>('/admin/rechercher-utilisateur', { params: { q } }),
  activate: (id: string) => api.patch(`/admin/activer-utilisateurs/${id}`),
  deactivate: (id: string) => api.patch(`/admin/desactiver-utilisateurs/${id}`),
};
