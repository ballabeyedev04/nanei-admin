import { api } from './axios';
import type { Avis, AvisStats, Pagination } from '@/types';
import { nettoyerParams, versPage } from './pagination';

/** Avis tel que le back le renvoie (colonnes et associations Sequelize). */
interface AvisBrut {
  id: string;
  note?: number | string | null;
  commentaire?: string | null;
  createdAt?: string;
  created_at?: string;
  colis?: { reference?: string | null; destination?: string | null } | null;
  utilisateur?: { nom?: string | null; prenom?: string | null; email?: string | null } | null;
}

interface ReponseAvis {
  avis?: AvisBrut[];
  data?: AvisBrut[];
  pagination?: Pagination | null;
  stats?: {
    total?: number | string;
    note_moyenne?: number | string;
    moyenne?: number | string;
    distribution?: Record<number, number>;
  };
}

/**
 * Le back renvoie `{ success, stats: { total, note_moyenne, distribution }, avis }`
 * et, pour chaque avis, `utilisateur` et `colis` (pas `client` ni
 * `colisReference`) : on convertit ici au format de l'écran.
 */
function versAvis(a: AvisBrut): Avis {
  return {
    id: a.id,
    colisReference: a.colis?.reference ?? '—',
    colisDestination: a.colis?.destination ?? undefined,
    client: {
      nom: a.utilisateur?.nom ?? '',
      prenom: a.utilisateur?.prenom ?? '',
      email: a.utilisateur?.email ?? undefined,
    },
    note: Number(a.note) || 0,
    commentaire: a.commentaire ?? undefined,
    // Toujours présent dans les réponses du back (horodatage Sequelize).
    createdAt: (a.createdAt ?? a.created_at) as string,
  };
}

export const avisApi = {
  /** `note` : 1 à 5. `stats` porte toujours sur TOUS les avis. */
  list: async (
    params?: { note?: number; page?: number; limit?: number },
  ): Promise<{ avis: Avis[]; stats: AvisStats; pagination: Pagination }> => {
    const res = await api.get<ReponseAvis>('/admin/avis', { params: nettoyerParams(params) });
    const raw = res.data;
    const { items: avis, pagination } = versPage((raw.avis ?? raw.data ?? []).map(versAvis), raw.pagination);
    const s = raw.stats ?? {};
    return {
      avis,
      pagination,
      stats: {
        moyenne: Number(s.note_moyenne ?? s.moyenne ?? 0),
        total: Number(s.total ?? avis.length),
        distribution: s.distribution ?? {},
      },
    };
  },
};
