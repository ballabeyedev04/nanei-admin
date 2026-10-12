import { api } from './axios';
import type { Pagination, ParamsListe, Rapport } from '@/types';
import { nettoyerParams } from './pagination';

export const rapportsApi = {
  /** Le back renvoie la liste sous `rapports` (anciennement lue sous `data`). */
  list: (params?: Omit<ParamsListe, 'q'>) =>
    api.get<{ success?: boolean; rapports?: Rapport[]; data?: Rapport[]; pagination?: Pagination }>('/admin/rapports', {
      params: nettoyerParams(params),
    }),
  // Nom encodé, comme l'URL que fabrique le back (`urlRapport`) : un « # » ou
  // un espace ne doit pas tronquer le chemin.
  download: (filename: string) =>
    api.get(`/admin/rapports/${encodeURIComponent(filename)}`, { responseType: 'blob' }),
  // Génération du PDF côté serveur (navigateur sans tête) : peut dépasser 15 s.
  generate: () => api.post('/admin/rapports/generer', undefined, { timeout: 120_000 }),
};
