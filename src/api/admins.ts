import { api } from './axios';
import type { Pagination, ParamsListe, User } from '@/types';
import { nettoyerParams } from './pagination';

/** Formes de réponse du back (gestionadmin.service.js). */
export const adminsApi = {
  /**
   * Sans `page` : liste complète (filtre du journal d'audit). `q` : nom,
   * prénom, e-mail, téléphone. L'admin connecté est exclu.
   */
  list: (params?: ParamsListe) =>
    api.get<{ success: boolean; message: string; data: User[]; pagination?: Pagination }>('/admin/liste-admins', {
      params: nettoyerParams(params),
    }),
  count: () => api.get<{ success: boolean; data: number }>('/admin/nombre-admins'),
  /** Recherche « contient » sur nom, prénom et/ou e-mail. Le back renvoie un TABLEAU NU. */
  search: (filtres: { nom?: string; prenom?: string; email?: string }) =>
    api.get<User[]>('/admin/rechercher-admin', { params: filtres }),
  /** Mot de passe : 8 caractères min., une majuscule, une minuscule, un chiffre. Téléphone vide → non renseigné. */
  create: (data: { nom: string; prenom: string; email: string; mot_de_passe: string; adresse?: string; telephone?: string }) =>
    api.post<{ success: boolean; message: string; data: User }>('/admin/ajouter-admin', data),
  activate: (id: string) => api.put<{ success: boolean; message: string; data: User }>(`/admin/activer-admin/${id}`),
  deactivate: (id: string) => api.put<{ success: boolean; message: string; data: User }>(`/admin/desactiver-admin/${id}`),
};
