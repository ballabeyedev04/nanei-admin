import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { paiementsApi } from './paiements';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat de `paiementsApi` avec le back (routes/admin/paiement.route.js,
 * services/admin/paiement.service.js). Rend impossible : un filtre `statut`
 * vide envoyé (le back répond 400 « Statut invalide »), un changement de
 * statut envoyé sur une autre route ou sous un autre nom de champ, des
 * statistiques lues ailleurs que sous `data`.
 */
describe('paiementsApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({ data: { success: true, data: [] } }));
  });

  it('list : GET /admin/paiements avec page, limit, q, statut', async () => {
    await paiementsApi.list({ page: 1, limit: 20, q: 'NAN', statut: 'paye' });
    expect(reseau.dernier()).toMatchObject({
      methode: 'GET', url: '/admin/paiements', params: { page: 1, limit: 20, q: 'NAN', statut: 'paye' },
    });
  });

  it('list : statut et q absents ou vides ne sont pas envoyés', async () => {
    await paiementsApi.list({ page: 1, limit: 20, q: '', statut: undefined });
    expect(reseau.dernier().params).toEqual({ page: 1, limit: 20 });
  });

  it('list : montants déjà en nombres (EUR) côté back, rendus tels quels', async () => {
    reseau = intercepter(api, () => ({
      data: { success: true, data: [{ id: 'p1', prixTotal: 12.5, montantPaye: 0, statut: 'en_attente' }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
    }));
    const res = await paiementsApi.list({ page: 1 });
    expect(res.data.data[0].prixTotal).toBe(12.5);
  });

  it('stats : GET /admin/paiements/stats, chiffres sous `data`', async () => {
    const stats = { total: 5, paye: 2, enAttente: 1, enCours: 1, echoue: 1, rembourse: 0, montantTotal: 40.5 };
    reseau = intercepter(api, () => ({ data: { success: true, data: stats } }));
    const res = await paiementsApi.stats();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/paiements/stats' });
    expect(res.data.data).toEqual(stats);
  });

  it('changerStatut : PUT /admin/paiements/:id/statut { statut }', async () => {
    await paiementsApi.changerStatut('p1', 'rembourse');
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/paiements/p1/statut', corps: { statut: 'rembourse' } });
  });
});
