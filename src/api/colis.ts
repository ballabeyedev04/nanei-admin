import { api } from './axios';
import type { Colis, Pagination, ParamsListe } from '@/types';
import { nettoyerParams } from './pagination';

/** Formes de réponse du back (gestioncolis.service.js) : listes sous `colis`, compteurs sous `nombre_colis`. */
type ListeColis = { success: boolean; message: string; colis: Colis[]; pagination?: Pagination };
type NombreColis = { success: boolean; message: string; nombre_colis: number };

export const colisApi = {
  /** Sans `page` : liste complète. `q` : référence ou destination (« contient »). */
  list: (params?: ParamsListe) => api.get<ListeColis>('/admin/liste-colis', { params: nettoyerParams(params) }),
  count: () => api.get<NombreColis>('/admin/nombre-colis'),
  enAttente: (params?: ParamsListe) => api.get<ListeColis>('/admin/colis-en-attente', { params: nettoyerParams(params) }),
  recuperes: (params?: ParamsListe) => api.get<ListeColis>('/admin/colis-recuperes', { params: nettoyerParams(params) }),
  livres: (params?: ParamsListe) => api.get<ListeColis>('/admin/colis-livres', { params: nettoyerParams(params) }),
  countEnAttente: () => api.get<NombreColis>('/admin/nombre-colis-en-attente'),
  countRecuperes: () => api.get<NombreColis>('/admin/nombre-colis-recuperes'),
  countLivres: () => api.get<NombreColis>('/admin/nombre-colis-livres'),
  /** `colis` vaut null si la référence est inconnue (réponse 200). */
  search: (ref: string) => api.get<{ success: boolean; message: string; colis: Colis | null }>(`/admin/colis-recherche/${encodeURIComponent(ref)}`),
  /**
   * Transitions permises par le back : en_attente → recupere, livre ;
   * recupere → livre, en_attente ; livre → aucune. Refus : 409 { message }.
   */
  setEnAttente: (id: string) => api.put(`/admin/changer-statut-en-attente/${id}`),
  setRecupere: (id: string) => api.put(`/admin/changer-statut-recupere/${id}`),
  setLivre: (id: string) => api.put(`/admin/changer-statut-livre/${id}`),
};
