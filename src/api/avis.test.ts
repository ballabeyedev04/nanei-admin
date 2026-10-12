import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { avisApi } from './avis';
import { intercepter } from '@/test/axiosFactice';

/**
 * Conversion de la réponse RÉELLE du back (controllers/client/avis.controller.js,
 * `adminAvis`) : `{ success, stats: { total, note_moyenne, distribution }, avis }`
 * avec, pour chaque avis, `utilisateur` et `colis` — et non `client` ni
 * `colisReference`. Rend impossible le retour de l'écran « Avis » qui plantait
 * (`a.client.prenom` sur undefined) ou affichait une moyenne à 0.
 */
const avisBack = {
  id: 'av1',
  note: 4,
  commentaire: 'Rapide',
  createdAt: '2026-10-01T10:00:00.000Z',
  colis: { reference: 'NAN-42', destination: 'Bamako' },
  utilisateur: { nom: 'Traoré', prenom: 'Moussa', email: 'm@ex.ml' },
};

describe('avisApi.list', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({
      data: {
        success: true,
        stats: { total: 10, note_moyenne: 4.3, distribution: { 1: 0, 2: 1, 3: 1, 4: 3, 5: 5 } },
        avis: [avisBack],
        pagination: { page: 1, limit: 20, total: 10, pages: 1 },
      },
    }));
  });

  it('GET /admin/avis avec note, page, limit (note absente non envoyée)', async () => {
    await avisApi.list({ note: 5, page: 2, limit: 20 });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/avis', params: { note: 5, page: 2, limit: 20 } });
    await avisApi.list({ note: undefined, page: 1, limit: 20 });
    expect(reseau.dernier().params).toEqual({ page: 1, limit: 20 });
  });

  it('convertit chaque avis : utilisateur → client, colis.reference → colisReference', async () => {
    const { avis } = await avisApi.list({ page: 1 });
    expect(avis[0]).toEqual({
      id: 'av1',
      colisReference: 'NAN-42',
      colisDestination: 'Bamako',
      client: { nom: 'Traoré', prenom: 'Moussa', email: 'm@ex.ml' },
      note: 4,
      commentaire: 'Rapide',
      createdAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it('relit les statistiques sous `stats.note_moyenne` (et non `moyenne`)', async () => {
    const { stats, pagination } = await avisApi.list({ page: 1 });
    expect(stats).toEqual({ moyenne: 4.3, total: 10, distribution: { 1: 0, 2: 1, 3: 1, 4: 3, 5: 5 } });
    expect(pagination).toEqual({ page: 1, limit: 20, total: 10, pages: 1 });
  });

  it('tolère un avis sans colis ni utilisateur (compte supprimé) sans planter', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, stats: {}, avis: [{ id: 'av2', note: '3', colis: null, utilisateur: null }] } }));
    const { avis, stats } = await avisApi.list();
    expect(avis[0]).toMatchObject({ colisReference: '—', client: { nom: '', prenom: '' }, note: 3 });
    expect(stats).toEqual({ moyenne: 0, total: 1, distribution: {} });
  });

  it('pagination absente (liste complète) : une seule page', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, stats: { total: 1, note_moyenne: 4 }, avis: [avisBack] } }));
    const { pagination } = await avisApi.list();
    expect(pagination).toEqual({ page: 1, limit: 1, total: 1, pages: 1 });
  });
});
