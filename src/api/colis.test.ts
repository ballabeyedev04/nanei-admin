import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { colisApi } from './colis';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat de `colisApi` avec le back (routes/admin/gestioncolis.routes.js,
 * services/admin/gestioncolis.service.js). Rend impossible : une liste lue
 * ailleurs que sous `colis`, un compteur ailleurs que sous `nombre_colis`, une
 * référence non encodée dans l'URL de recherche, un changement de statut
 * envoyé sur une route inexistante.
 */
describe('colisApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({ data: { success: true, colis: [] } }));
  });

  it.each([
    ['list', '/admin/liste-colis'],
    ['enAttente', '/admin/colis-en-attente'],
    ['recuperes', '/admin/colis-recuperes'],
    ['livres', '/admin/colis-livres'],
  ] as const)('%s : GET %s avec page, limit et q', async (fn, chemin) => {
    await colisApi[fn]({ page: 1, limit: 20, q: 'NAN-1' });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: chemin, params: { page: 1, limit: 20, q: 'NAN-1' } });
  });

  it('list : la réponse du back (colis + pagination + taille_lot) est rendue telle quelle', async () => {
    const colis = [{ id: 'c1', reference: 'NAN-1', statut: 'en_attente', lot_id: 'L1', taille_lot: 3 }];
    reseau = intercepter(api, () => ({ data: { success: true, message: 'ok', colis, pagination: { page: 1, limit: 20, total: 1, pages: 1 } } }));
    const res = await colisApi.list({ page: 1 });
    expect(res.data.colis[0].taille_lot).toBe(3);
    expect(res.data.pagination?.total).toBe(1);
  });

  it.each([
    ['count', '/admin/nombre-colis'],
    ['countEnAttente', '/admin/nombre-colis-en-attente'],
    ['countRecuperes', '/admin/nombre-colis-recuperes'],
    ['countLivres', '/admin/nombre-colis-livres'],
  ] as const)('%s : GET %s, compteur sous nombre_colis', async (fn, chemin) => {
    reseau = intercepter(api, () => ({ data: { success: true, message: 'ok', nombre_colis: 7 } }));
    const res = await colisApi[fn]();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: chemin });
    expect(res.data.nombre_colis).toBe(7);
  });

  it('search : référence encodée dans le chemin, `colis` null si inconnue', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, message: 'ok', colis: null } }));
    const res = await colisApi.search('NAN/2026 #1');
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/colis-recherche/NAN%2F2026%20%231' });
    expect(res.data.colis).toBeNull();
  });

  it.each([
    ['setEnAttente', '/admin/changer-statut-en-attente/c9'],
    ['setRecupere', '/admin/changer-statut-recupere/c9'],
    ['setLivre', '/admin/changer-statut-livre/c9'],
  ] as const)('%s : PUT %s sans corps', async (fn, chemin) => {
    await colisApi[fn]('c9');
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: chemin });
    expect(reseau.dernier().corps).toBeUndefined();
  });

  it('transition refusée : le 409 du back remonte avec son message', async () => {
    reseau = intercepter(api, () => ({ status: 409, data: { success: false, message: 'Un colis livré ne peut plus changer de statut' } }));
    await expect(colisApi.setEnAttente('c9')).rejects.toMatchObject({
      response: { status: 409, data: { message: 'Un colis livré ne peut plus changer de statut' } },
    });
  });
});
