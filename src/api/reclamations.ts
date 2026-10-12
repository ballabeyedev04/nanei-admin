import { api } from './axios';
import type { PageListe, Pagination, Reclamation, StatutReclamation, TypeReclamation } from '@/types';
import { nettoyerParams, versPage } from './pagination';

/** Réclamation telle que le back la renvoie (colonnes et associations Sequelize). */
interface ReclamationBrute {
  id: string;
  type?: string;
  statut: StatutReclamation;
  description?: string | null;
  /** Tableau JSON, ou chaîne JSON selon le dialecte SQL. */
  photos?: unknown;
  commentaire_admin?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  colis?: { reference?: string | null; destination?: string | null } | null;
  utilisateur?: { nom?: string | null; prenom?: string | null; email?: string | null; telephone?: string | null } | null;
}

/**
 * Le back renvoie `{ success, reclamations }` et, pour chaque réclamation,
 * `colis.reference`, `utilisateur` et `commentaire_admin` (pas `client`,
 * `colisReference` ni `historique`) : on convertit ici au format de l'écran.
 */
function versReclamation(r: ReclamationBrute): Reclamation {
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
    // Toujours présent dans les réponses du back (horodatage Sequelize).
    createdAt: (r.createdAt ?? r.created_at) as string,
    updatedAt: r.updatedAt ?? r.updated_at,
  };
}

export const reclamationsApi = {
  /** `statut` : ouverte, en_cours, resolue, rejetee (autre valeur → 400). */
  list: async (
    params?: { statut?: StatutReclamation; page?: number; limit?: number },
  ): Promise<PageListe<Reclamation>> => {
    const res = await api.get<{ reclamations?: ReclamationBrute[]; data?: ReclamationBrute[]; pagination?: Pagination | null }>(
      '/admin/reclamations', { params: nettoyerParams(params) },
    );
    const raw = res.data;
    return versPage((raw.reclamations ?? raw.data ?? []).map(versReclamation), raw.pagination);
  },
  /** Le back lit `commentaire_admin` (envoyé au client par e-mail et SMS). */
  update: async (id: string, statut: StatutReclamation, commentaire?: string): Promise<Reclamation> => {
    const corps: Record<string, unknown> = { statut };
    if (commentaire !== undefined) corps.commentaire_admin = commentaire;
    const res = await api.put<{ reclamation?: ReclamationBrute }>(`/admin/reclamations/${id}`, corps);
    // Réponse sans réclamation : objet vide converti (comportement historique).
    return versReclamation(res.data.reclamation ?? ({} as ReclamationBrute));
  },
};
