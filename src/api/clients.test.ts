import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { clientsApi } from './clients';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat de `clientsApi` avec le back (routes/admin/gestionutilisateur.route.js,
 * controllers/admin/gestionutilisateur.controller.js). Rend impossible : un PUT
 * là où le back n'accepte que PATCH (activer / désactiver → 404), un compteur
 * lu sous un autre nom que `total`.
 */
describe('clientsApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({ data: { success: true, total: 0, data: [] } }));
  });

  it('list : GET /admin/liste-utilisateurs avec page, limit, q', async () => {
    reseau = intercepter(api, () => ({
      data: { success: true, total: 41, data: [{ id: 'u1' }], pagination: { page: 3, limit: 20, total: 41, pages: 3 } },
    }));
    const res = await clientsApi.list({ page: 3, limit: 20, q: 'fall' });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/liste-utilisateurs', params: { page: 3, limit: 20, q: 'fall' } });
    expect(res.data.total).toBe(41);
    expect(res.data.pagination?.pages).toBe(3);
  });

  it('count : GET /admin/nombre-utilisateurs, total sous `total`', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, total: 12 } }));
    const res = await clientsApi.count();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/nombre-utilisateurs' });
    expect(res.data.total).toBe(12);
  });

  it('search : GET /admin/rechercher-utilisateur avec nom / prenom / email', async () => {
    await clientsApi.search({ email: 'a@b.sn' });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/rechercher-utilisateur', params: { email: 'a@b.sn' } });
  });

  it('activate / deactivate : PATCH (et non PUT) sur /admin/(des)activer-utilisateurs/:id', async () => {
    await clientsApi.activate('c1');
    expect(reseau.dernier()).toMatchObject({ methode: 'PATCH', url: '/admin/activer-utilisateurs/c1' });
    await clientsApi.deactivate('c2');
    expect(reseau.dernier()).toMatchObject({ methode: 'PATCH', url: '/admin/desactiver-utilisateurs/c2' });
  });
});
