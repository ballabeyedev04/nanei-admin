import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './axios';
import { adminsApi } from './admins';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat de `adminsApi` avec le back (routes/admin/gestionadmin.route.js,
 * services/admin/gestionadmin.service.js). Rend impossible : un verbe ou un
 * chemin qui ne correspond plus à une route (404 silencieux à l'écran), un
 * paramètre vide envoyé (`q=` filtrait sur une chaîne vide), un champ de
 * création mal nommé (le back lit `mot_de_passe`, `telephone`, `adresse`).
 */
describe('adminsApi', () => {
  let reseau: ReturnType<typeof intercepter>;
  beforeEach(() => {
    reseau = intercepter(api, () => ({ data: { success: true, data: [] } }));
  });

  it('list : GET /admin/liste-admins avec page, limit et q nettoyé', async () => {
    await adminsApi.list({ page: 2, limit: 20, q: '  diallo ' });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/liste-admins', params: { page: 2, limit: 20, q: 'diallo' } });
  });

  it('list : un `q` vide n’est pas envoyé', async () => {
    await adminsApi.list({ page: 1, q: '   ' });
    expect(reseau.dernier().params).toEqual({ page: 1 });
  });

  it('list sans paramètre : liste complète (aucun paramètre de pagination)', async () => {
    await adminsApi.list();
    expect(reseau.dernier().params).toBeUndefined();
  });

  it('count : GET /admin/nombre-admins, total sous `data`', async () => {
    reseau = intercepter(api, () => ({ data: { success: true, data: 4 } }));
    const res = await adminsApi.count();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/nombre-admins' });
    expect(res.data.data).toBe(4);
  });

  it('search : GET /admin/rechercher-admin, le back renvoie un tableau nu', async () => {
    reseau = intercepter(api, () => ({ data: [{ id: 'a1', nom: 'Diallo' }] }));
    const res = await adminsApi.search({ nom: 'Dia' });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/rechercher-admin', params: { nom: 'Dia' } });
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('create : POST /admin/ajouter-admin avec les noms de champs du back', async () => {
    const corps = { nom: 'Ba', prenom: 'Awa', email: 'awa@ex.sn', mot_de_passe: 'Secret123', telephone: '', adresse: 'Dakar' };
    await adminsApi.create(corps);
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/ajouter-admin', corps });
  });

  it('activate / deactivate : PUT /admin/activer-admin/:id et /admin/desactiver-admin/:id', async () => {
    await adminsApi.activate('id-1');
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/activer-admin/id-1' });
    await adminsApi.deactivate('id-2');
    expect(reseau.dernier()).toMatchObject({ methode: 'PUT', url: '/admin/desactiver-admin/id-2' });
  });
});
