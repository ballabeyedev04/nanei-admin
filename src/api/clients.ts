import { api } from './axios';
import type { Pagination, ParamsListe, User } from '@/types';
import { nettoyerParams } from './pagination';

/** Formes de réponse du back (gestionutilisateur.controller.js). */
export const clientsApi = {
  /** `q` : nom, prénom, e-mail, téléphone. `total` = total toutes pages. */
  list: (params?: ParamsListe) =>
    api.get<{ success: boolean; total: number; data: User[]; pagination?: Pagination }>('/admin/liste-utilisateurs', {
      params: nettoyerParams(params),
    }),
  count: () => api.get<{ success: boolean; total: number }>('/admin/nombre-utilisateurs'),
  /** Recherche « contient » sur nom, prénom et/ou e-mail. */
  search: (filtres: { nom?: string; prenom?: string; email?: string }) =>
    api.get<{ success: boolean; data: User[] }>('/admin/rechercher-utilisateur', { params: filtres }),
  activate: (id: string) => api.patch<{ success: boolean; message: string; data: User }>(`/admin/activer-utilisateurs/${id}`),
  deactivate: (id: string) => api.patch<{ success: boolean; message: string; data: User }>(`/admin/desactiver-utilisateurs/${id}`),
};
