import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { reclamationsApi } from './reclamations';
import { intercepter } from '@/test/axiosFactice';

/**
 * Conversion de la réponse RÉELLE du back (controllers/client/reclamation.controller.js,
 * `adminList` / `adminUpdate`) : liste sous `reclamations`, `utilisateur`,
 * `colis.reference`, `commentaire_admin`, type `endommagé` AVEC accent,
 * `photos` en JSON. Rend impossible : l'écran qui plantait sur `r.client`,
 * le commentaire de l'admin envoyé sous `commentaire` puis perdu, des photos
 * stockées en chaîne affichées lettre par lettre.
 */
const reclamationBack = {
  id: 'rec-000123',
  type: 'endommagé',
  statut: 'ouverte',
  description: 'Carton écrasé',
  photos: ['https://cdn/p1.jpg', ''],
  commentaire_admin: 'Nous vérifions',
  createdAt: '2026-10-02T08:00:00.000Z',
  updatedAt: '2026-10-03T08:00:00.000Z',
  colis: { reference: 'NAN-7', statut: 'livre', destination: 'Kayes' },
  utilisateur: { nom: 'Keita', prenom: 'Awa', email: 'awa@ex.ml', telephone: '+22370000000' },
};

describe('reclamationsApi.list', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({
      data: { success: true, reclamations: [reclamationBack], pagination: { page: 1, limit: 20, total: 1, pages: 1 } },
    }));
  });

  it('GET /admin/reclamations avec statut, page, limit (statut absent non envoyé)', async () => {
    await reclamationsApi.list({ statut: 'en_cours', page: 1, limit: 20 });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/reclamations', params: { statut: 'en_cours', page: 1, limit: 20 } });
    await reclamationsApi.list({ statut: undefined, page: 1 });
    expect(reseau.dernier().params).toEqual({ page: 1 });
  });

  it('convertit : utilisateur → client, colis.reference → colisReference, commentaire_admin → commentaireAdmin', async () => {
    const { items, pagination } = await reclamationsApi.list({ page: 1 });
    expect(items[0]).toEqual({
      id: 'rec-000123',
      colisReference: 'NAN-7',
      colisDestination: 'Kayes',
      client: { nom: 'Keita', prenom: 'Awa', email: 'awa@ex.ml', telephone: '+22370000000' },
      type: 'endommagé',
      statut: 'ouverte',
      description: 'Carton écrasé',
      photos: ['https://cdn/p1.jpg'],
      commentaireAdmin: 'Nous vérifions',
      createdAt: '2026-10-02T08:00:00.000Z',
      updatedAt: '2026-10-03T08:00:00.000Z',
    });
    expect(pagination.total).toBe(1);
  });

  it('photos en chaîne JSON, chaîne simple ou null : toujours un tableau', async () => {
    reseau = intercepter(api, () => ({
      data: {
        success: true,
        reclamations: [
          { ...reclamationBack, id: 'a', photos: '["u1","u2"]' },
          { ...reclamationBack, id: 'b', photos: 'https://cdn/seule.jpg' },
          { ...reclamationBack, id: 'c', photos: null },
        ],
      },
    }));
    const { items } = await reclamationsApi.list();
    expect(items.map((r) => r.photos)).toEqual([['u1', 'u2'], ['https://cdn/seule.jpg'], []]);
  });

  it('ancienne valeur `endommage` (sans accent) ramenée à `endommagé`', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, reclamations: [{ ...reclamationBack, type: 'endommage' }] } }));
    const { items } = await reclamationsApi.list();
    expect(items[0].type).toBe('endommagé');
  });

  it('pagination absente : une seule page ; utilisateur/colis absents : pas de plantage', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, reclamations: [{ id: 'x', statut: 'ouverte', type: 'autre' }] } }));
    const { items, pagination } = await reclamationsApi.list();
    expect(pagination).toEqual({ page: 1, limit: 1, total: 1, pages: 1 });
    expect(items[0]).toMatchObject({ colisReference: '—', client: { nom: '', prenom: '', email: '' }, photos: [], description: '' });
  });
});

describe('reclamationsApi.update', () => {
  it('PUT /admin/reclamations/:id avec { statut, commentaire_admin } et relit `reclamation`', async () => {
    const reseau = intercepter(api, () => ({
      data: { success: true, message: 'Réclamation mise à jour', reclamation: { ...reclamationBack, statut: 'resolue', commentaire_admin: 'Remboursé' } },
    }));
    const r = await reclamationsApi.update('rec-000123', 'resolue', 'Remboursé');
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/reclamations/rec-000123' });
    expect(reseau.dernier().corps).toEqual({ statut: 'resolue', commentaire_admin: 'Remboursé' });
    expect(r).toMatchObject({ statut: 'resolue', commentaireAdmin: 'Remboursé', colisReference: 'NAN-7' });
  });

  it('sans commentaire : la clé n’est pas envoyée (le commentaire existant n’est pas effacé)', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true, reclamation: reclamationBack } }));
    await reclamationsApi.update('rec-000123', 'en_cours');
    expect(reseau.dernier().corps).toEqual({ statut: 'en_cours' });
  });
});
