import { api } from './axios';
import type { Avis, AvisStats, Pagination } from '@/types';
import { nettoyerParams, versPage } from './pagination';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Le back renvoie `{ success, stats: { total, note_moyenne, distribution }, avis }`
 * et, pour chaque avis, `utilisateur` et `colis` (pas `client` ni
 * `colisReference`) : on convertit ici au format de l'écran.
 */
function versAvis(a: any): Avis {
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
    createdAt: a.createdAt ?? a.created_at,
  };
}

export const avisApi = {
  /** `note` : 1 à 5. `stats` porte toujours sur TOUS les avis. */
  list: async (
    params?: { note?: number; page?: number; limit?: number },
  ): Promise<{ avis: Avis[]; stats: AvisStats; pagination: Pagination }> => {
    const res = await api.get('/admin/avis', { params: nettoyerParams(params) });
    const raw = res.data as any;
    const { items: avis, pagination } = versPage(((raw.avis ?? raw.data ?? []) as any[]).map(versAvis), raw.pagination);
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
