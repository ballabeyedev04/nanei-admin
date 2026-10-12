import axios from 'axios';
import { api } from './axios';
import type { PreuveLivraison } from '@/types';

export const preuveLivraisonApi = {
  /**
   * Le back renvoie `{ success, preuve: { photo_url, gps_lat, gps_lng, … } }`,
   * ou 404 « Aucune preuve trouvée » : on renvoie alors `null`.
   */
  get: async (colisId: string): Promise<PreuveLivraison | null> => {
    try {
      const res = await api.get<{ preuve?: PreuveLivraison | null; data?: PreuveLivraison | null }>(`/admin/colis/${colisId}/preuve`);
      const raw = res.data;
      const preuve = raw.preuve ?? raw.data ?? null;
      return preuve && preuve.photo_url ? preuve : null;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return null;
      throw err;
    }
  },
  /**
   * Une seule preuve par colis : si elle existe, le back répond 409 sauf si
   * `remplacer` vaut true (remplacement confirmé par l'admin).
   */
  upload: (colisId: string, formData: FormData, remplacer = false) =>
    api.post(`/admin/colis/${colisId}/preuve`, formData, {
      params: remplacer ? { remplacer: 'true' } : undefined,
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000, // envoi de photo : plus long que 15 s sur une connexion lente
    }),
};
