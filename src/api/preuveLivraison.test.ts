import { describe, it, expect } from 'vitest';
import { api } from './axios';
import { preuveLivraisonApi } from './preuveLivraison';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat de `preuveLivraisonApi` avec le back (routes/admin/preuve.route.js,
 * controllers/admin/preuve.controller.js). Rend impossible : une preuve lue
 * ailleurs que sous `preuve.photo_url`, le 404 « Aucune preuve trouvée » pris
 * pour une panne (l'admin ne pouvait plus ajouter de preuve), une autre
 * erreur prise pour « aucune preuve » (l'admin écrasait une preuve existante
 * sans le savoir), une photo envoyée sous un autre champ que `photo`.
 */
describe('preuveLivraisonApi.get', () => {
  it('GET /admin/colis/:id/preuve et relit `preuve` (photo_url, GPS)', async () => {
    const preuve = { id: 'p1', colis_id: 'c1', photo_url: 'https://r2/p.jpg', gps_lat: '14.7', gps_lng: '-17.4', commentaire: null, createdAt: '2026-10-01' };
    const reseau = intercepter(api, () => ({ data: { success: true, preuve } }));
    await expect(preuveLivraisonApi.get('c1')).resolves.toEqual(preuve);
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/colis/c1/preuve' });
  });

  it('404 « Aucune preuve trouvée » → null', async () => {
    intercepter(api, () => ({ status: 404, data: { success: false, message: 'Aucune preuve trouvée' } }));
    await expect(preuveLivraisonApi.get('c1')).resolves.toBeNull();
  });

  it('preuve sans photo_url → null', async () => {
    intercepter(api, () => ({ data: { success: true, preuve: { id: 'p1' } } }));
    await expect(preuveLivraisonApi.get('c1')).resolves.toBeNull();
  });

  it('500 : l’erreur remonte (jamais confondue avec « aucune preuve »)', async () => {
    intercepter(api, () => ({ status: 500, data: { message: 'Erreur serveur' } }));
    await expect(preuveLivraisonApi.get('c1')).rejects.toMatchObject({ response: { status: 500 } });
  });
});

describe('preuveLivraisonApi.upload', () => {
  it('POST multipart sur /admin/colis/:id/preuve, champ `photo`, sans `remplacer` par défaut', async () => {
    const reseau = intercepter(api, () => ({ status: 201, data: { success: true } }));
    const fd = new FormData();
    fd.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg');
    await preuveLivraisonApi.upload('c1', fd);
    const appel = reseau.dernier();
    expect(appel).toMatchObject({ methode: 'POST', url: '/admin/colis/c1/preuve', params: undefined });
    expect(appel.corps).toBeInstanceOf(FormData);
    expect((appel.corps as FormData).get('photo')).toBeTruthy();
    expect(appel.config.timeout).toBe(60_000);
  });

  it('remplacement confirmé : ?remplacer=true (lu par le back dans query ou body)', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true } }));
    await preuveLivraisonApi.upload('c1', new FormData(), true);
    expect(reseau.dernier().params).toEqual({ remplacer: 'true' });
  });
});
