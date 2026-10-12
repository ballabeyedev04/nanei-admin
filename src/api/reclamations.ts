import { api } from './axios';
import type { PageListe, Reclamation, StatutReclamation, TypeReclamation } from '@/types';
import { nettoyerParams, versPage } from './pagination';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Le back renvoie `{ success, reclamations }` et, pour chaque réclamation,
 * `colis.reference`, `utilisateur` et `commentaire_admin` (pas `client`,
 * `colisReference` ni `historique`) : on convertit ici au format de l'écran.
 */
function versReclamation(r: any): Reclamation {
  // Le back stocke `endommagé` (avec accent) ; on tolère l'ancienne valeur.
  const type = (r.type === 'endommage' ? 'endommagé' : r.type) as TypeReclamation;
  let photos: unknown = r.photos;
  if (typeof photos === 'string') {
    try { photos = JSON.parse(photos); } catch { photos = [photos]; }
  }
  return {
    id: r.id,
    colisReference: r.colis?.reference ?? '—',
    colisDestination: r.colis?.destination ?? undefined,
    client: {
      nom: r.utilisateur?.nom ?? '',
      prenom: r.utilisateur?.prenom ?? '',
      email: r.utilisateur?.email ?? '',
      telephone: r.utilisateur?.telephone ?? undefined,
    },
    type,
    statut: r.statut,
    description: r.description ?? '',
    photos: Array.isArray(photos) ? (photos as string[]).filter(Boolean) : [],
    commentaireAdmin: r.commentaire_admin ?? undefined,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  };
}

export const reclamationsApi = {
  /** `statut` : ouverte, en_cours, resolue, rejetee (autre valeur → 400). */
  list: async (
    params?: { statut?: StatutReclamation; page?: number; limit?: number },
  ): Promise<PageListe<Reclamation>> => {
    const res = await api.get('/admin/reclamations', { params: nettoyerParams(params) });
    const raw = res.data as any;
    return versPage(((raw.reclamations ?? raw.data ?? []) as any[]).map(versReclamation), raw.pagination);
  },
  /** Le back lit `commentaire_admin` (envoyé au client par e-mail et SMS). */
  update: async (id: string, statut: StatutReclamation, commentaire?: string): Promise<Reclamation> => {
    const corps: Record<string, unknown> = { statut };
    if (commentaire !== undefined) corps.commentaire_admin = commentaire;
    const res = await api.put(`/admin/reclamations/${id}`, corps);
    return versReclamation((res.data as any).reclamation ?? {});
  },
};
