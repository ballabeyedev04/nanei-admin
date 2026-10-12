import { api } from './axios';
import { nettoyerParams } from './pagination';
import type { Pagination, ParamsListe } from '@/types';

export type StatutPaiement = 'en_attente' | 'en_cours' | 'paye' | 'echoue' | 'rembourse';

export interface Paiement {
  id: string;
  colisId: string;
  payeurId: string;
  prixTotal: number;
  montantPaye: number;
  moyenPaiement: 'orange_money' | 'wave' | null;
  statut: StatutPaiement;
  referenceTransaction: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
  colis?: {
    id: string;
    reference: string;
    poids: number;
    destination: string;
    type_colis: string;
    statut: string;
  };
  payeur?: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
  };
}

export interface PaiementStats {
  total: number;
  paye: number;
  enAttente: number;
  enCours: number;
  echoue: number;
  rembourse: number;
  montantTotal: number;
}

export const paiementsApi = {
  /** `q` : référence colis, destination, payeur, référence opérateur. `statut` invalide → 400. */
  list:        (params?: ParamsListe & { statut?: StatutPaiement }) =>
    api.get<{ success: boolean; data: Paiement[]; pagination?: Pagination }>('/admin/paiements', { params: nettoyerParams(params) }),
  stats:       () => api.get<{ success: boolean; data: PaiementStats }>('/admin/paiements/stats'),
  changerStatut: (id: string, statut: StatutPaiement) =>
    api.put(`/admin/paiements/${id}/statut`, { statut }),
};
