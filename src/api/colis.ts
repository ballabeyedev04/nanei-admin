import { api } from './axios';
import type { Colis } from '@/types';

export const colisApi = {
  list: () => api.get<{ data: Colis[] }>('/admin/liste-colis'),
  count: () => api.get<{ nombre: number }>('/admin/nombre-colis'),
  enAttente: () => api.get<{ data: Colis[] }>('/admin/colis-en-attente'),
  recuperes: () => api.get<{ data: Colis[] }>('/admin/colis-recuperes'),
  livres: () => api.get<{ data: Colis[] }>('/admin/colis-livres'),
  countEnAttente: () => api.get<{ nombre: number }>('/admin/nombre-colis-en-attente'),
  countRecuperes: () => api.get<{ nombre: number }>('/admin/nombre-colis-recuperes'),
  countLivres: () => api.get<{ nombre: number }>('/admin/nombre-colis-livres'),
  search: (ref: string) => api.get<{ data: Colis }>(`/admin/colis-recherche/${ref}`),
  setEnAttente: (id: string) => api.put(`/admin/changer-statut-en-attente/${id}`),
  setRecupere: (id: string) => api.put(`/admin/changer-statut-recupere/${id}`),
  setLivre: (id: string) => api.put(`/admin/changer-statut-livre/${id}`),
};
