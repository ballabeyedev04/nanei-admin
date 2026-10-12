import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { creerAdaptateur, erreurReseau, type ReponseFactice } from '@/test/axiosFactice';

/**
 * Intercepteurs de `api/axios.ts` : jeton, renouvellement, déconnexion.
 *
 * Rend impossible :
 *  - la déconnexion au bout d'1 h (jeton d'accès expiré non renouvelé) ;
 *  - N renouvellements en parallèle quand N requêtes reçoivent 401 en même
 *    temps (le back fait TOURNER le refresh token : le 2e renouvellement
 *    envoyait un jeton déjà révoqué → 401 → déconnexion) ;
 *  - la déconnexion sur une simple panne (429, 5xx, réseau) pendant le
 *    renouvellement, qui faisait perdre la saisie en cours ;
 *  - un compte désactivé qui reste connecté (403 « Compte désactivé ») et, à
 *    l'inverse, une déconnexion sur un 403 MÉTIER ;
 *  - la déconnexion de tous les onglets quand UN onglet a renouvelé la
 *    session (les autres doivent relire le stockage partagé).
 *
 * Le module est rechargé à chaque test (état interne : renouvellement en
 * cours, anti-boucle de redirection) ; aucune requête ne quitte le test.
 */

const CLE = 'nanei-admin-auth';
const ADMIN = { id: 'a1', nom: 'Ba', prenom: 'Awa', email: 'awa@nanei.com', role: 'Admin' as const, statut: 'actif' as const };

type Module = typeof import('./axios');
type Store = typeof import('@/store/authStore')['useAuthStore'];

let mod: Module;
let useAuthStore: Store;
let reseau: ReturnType<typeof creerAdaptateur>;
let repondre: (config: InternalAxiosRequestConfig) => ReponseFactice | Promise<ReponseFactice>;

const jeton = (config: InternalAxiosRequestConfig) => {
  const brut = String(config.headers?.Authorization ?? '');
  return brut.startsWith('Bearer ') ? brut.slice(7) : null;
};
const appelsRefresh = () => reseau.appels.filter((a) => a.url === '/auth/refresh');
const ecrireStockage = (token: string | null, refreshToken: string | null) =>
  window.localStorage.setItem(CLE, JSON.stringify({ state: { user: ADMIN, token, refreshToken }, version: 0 }));
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  vi.resetModules();
  // jsdom n'implémente pas la navigation (window.location.replace) et le
  // signale sur console.error : sans intérêt ici.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  repondre = () => ({ data: { ok: true } });
  reseau = creerAdaptateur((config) => repondre(config));
  // Adaptateur posé sur les valeurs par défaut AVANT le chargement du module :
  // `api` ET le client de renouvellement (créé sans intercepteur) en héritent.
  const axios = (await import('axios')).default;
  axios.defaults.adapter = reseau.adaptateur;
  mod = await import('./axios');
  ({ useAuthStore } = await import('@/store/authStore'));
  useAuthStore.getState().setAuth(ADMIN, 'vieux', 'rt-1');
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'locks');
});

describe('intercepteur de requête', () => {
  it('ajoute Authorization: Bearer <jeton> du store', async () => {
    await mod.api.get('/admin/liste-colis');
    expect(jeton(reseau.dernier().config)).toBe('vieux');
  });

  it('sans session : aucun en-tête Authorization', async () => {
    useAuthStore.getState().clearAuth();
    await mod.api.get('/admin/liste-colis');
    expect(reseau.dernier().config.headers.Authorization).toBeUndefined();
  });
});

describe('401 : renouvellement du jeton', () => {
  it('UN SEUL renouvellement partagé entre requêtes concurrentes, puis rejeu de chacune', async () => {
    repondre = async (config) => {
      if (config.url === '/auth/refresh') {
        await attendre(20); // renouvellement lent : les autres 401 arrivent pendant
        return { data: { token: 'neuf', refreshToken: 'rt-2' } };
      }
      return jeton(config) === 'neuf' ? { data: { url: config.url } } : { status: 401, data: { message: 'Token invalide' } };
    };

    const reponses = await Promise.all([
      mod.api.get('/admin/liste-colis'),
      mod.api.get('/admin/paiements'),
      mod.api.get('/admin/avis'),
    ]);

    expect(reponses.map((r) => r.data.url)).toEqual(['/admin/liste-colis', '/admin/paiements', '/admin/avis']);
    expect(appelsRefresh()).toHaveLength(1);
    expect(appelsRefresh()[0]).toMatchObject({ methode: 'POST', corps: { refreshToken: 'rt-1' } });
    // Le refresh token TOURNE : le nouveau doit être conservé.
    expect(useAuthStore.getState()).toMatchObject({ token: 'neuf', refreshToken: 'rt-2', user: ADMIN });
    // Le rejeu porte le nouveau jeton.
    const rejoues = reseau.appels.filter((a) => a.url !== '/auth/refresh' && jeton(a.config) === 'neuf');
    expect(rejoues).toHaveLength(3);
  });

  it('le refresh part sans intercepteur ni jeton d’accès (pas de boucle 401 → refresh)', async () => {
    repondre = (config) => {
      if (config.url === '/auth/refresh') return { data: { token: 'neuf', refreshToken: 'rt-2' } };
      return jeton(config) === 'neuf' ? { data: {} } : { status: 401 };
    };
    await mod.api.get('/admin/avis');
    expect(appelsRefresh()[0].config.headers.Authorization).toBeUndefined();
  });

  it('un rejeu qui reçoit encore 401 déconnecte (pas de boucle infinie)', async () => {
    repondre = (config) =>
      config.url === '/auth/refresh' ? { data: { token: 'neuf', refreshToken: 'rt-2' } } : { status: 401, data: {} };
    await expect(mod.api.get('/admin/avis')).rejects.toMatchObject({ response: { status: 401 } });
    expect(appelsRefresh()).toHaveLength(1);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it.each([400, 401])('refresh refusé (%i) → déconnexion', async (statut) => {
    repondre = (config) =>
      config.url === '/auth/refresh' ? { status: statut, data: { message: 'Refresh token invalide ou révoqué' } } : { status: 401 };
    await expect(mod.api.get('/admin/avis')).rejects.toMatchObject({ response: { status: 401 } });
    expect(useAuthStore.getState()).toMatchObject({ token: null, refreshToken: null, user: null });
  });

  it.each([
    ['429', { status: 429, data: { message: 'Trop de requêtes' } }],
    ['500', { status: 500, data: { message: 'Erreur serveur' } }],
    ['503', { status: 503, data: {} }],
  ])('refresh en échec temporaire (%s) → PAS de déconnexion, l’erreur du refresh remonte', async (_nom, reponseRefresh) => {
    repondre = (config) => (config.url === '/auth/refresh' ? reponseRefresh : { status: 401 });
    await expect(mod.api.get('/admin/avis')).rejects.toMatchObject({ response: { status: reponseRefresh.status } });
    expect(useAuthStore.getState()).toMatchObject({ token: 'vieux', refreshToken: 'rt-1', user: ADMIN });
  });

  it('refresh impossible faute de réseau → PAS de déconnexion', async () => {
    repondre = (config) => {
      if (config.url === '/auth/refresh') throw erreurReseau(config);
      return { status: 401 };
    };
    await expect(mod.api.get('/admin/avis')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(useAuthStore.getState().token).toBe('vieux');
  });

  it('sans refresh token : déconnexion directe, aucun appel /auth/refresh', async () => {
    useAuthStore.getState().setAuth(ADMIN, 'vieux', null);
    repondre = () => ({ status: 401 });
    await expect(mod.api.get('/admin/avis')).rejects.toBeTruthy();
    expect(appelsRefresh()).toHaveLength(0);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('route publique (/auth/login) : un 401 ne déclenche ni renouvellement ni déconnexion', async () => {
    repondre = () => ({ status: 401, data: { message: 'Identifiants incorrects' } });
    await expect(mod.api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    expect(appelsRefresh()).toHaveLength(0);
    expect(useAuthStore.getState().token).toBe('vieux');
  });

  it('Web Locks disponible : le renouvellement passe par le verrou nanei-admin-refresh (un seul entre onglets)', async () => {
    const request = vi.fn((_nom: string, tache: () => Promise<unknown>) => tache());
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    repondre = (config) => {
      if (config.url === '/auth/refresh') return { data: { token: 'neuf', refreshToken: 'rt-2' } };
      return jeton(config) === 'neuf' ? { data: {} } : { status: 401 };
    };
    await mod.api.get('/admin/avis');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('nanei-admin-refresh');
  });
});

describe('403', () => {
  it.each([
    'Compte désactivé. Contactez le support.',                                    // auth.middleware.js
    'Votre compte est désactivé. Veuillez contacter le support ou réactiver votre compte.', // checkActiveUser
    'Accès refusé',                                                               // isAdmin.middlewares.js
  ])('« %s » → déconnexion', async (message) => {
    repondre = () => ({ status: 403, data: { message } });
    await expect(mod.api.get('/admin/avis')).rejects.toMatchObject({ response: { status: 403 } });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('autre 403 (refus métier) → l’erreur remonte, la session est conservée', async () => {
    repondre = () => ({ status: 403, data: { message: 'Action non autorisée sur ce colis' } });
    await expect(mod.api.get('/admin/avis')).rejects.toMatchObject({ response: { status: 403 } });
    expect(useAuthStore.getState().token).toBe('vieux');
  });

  it('404 / 409 / 500 : jamais de déconnexion', async () => {
    for (const status of [404, 409, 500]) {
      repondre = () => ({ status, data: { message: 'x' } });
      await expect(mod.api.get('/admin/avis')).rejects.toBeTruthy();
    }
    expect(useAuthStore.getState().token).toBe('vieux');
    expect(appelsRefresh()).toHaveLength(0);
  });
});

describe('synchronisation entre onglets (stockage partagé)', () => {
  it('un autre onglet a déjà renouvelé : rejeu avec SON jeton, sans nouveau refresh', async () => {
    // L'autre onglet a écrit la nouvelle session dans localStorage ; cet
    // onglet a encore l'ancienne en mémoire.
    ecrireStockage('jeton-autre-onglet', 'rt-autre');
    repondre = (config) => (jeton(config) === 'jeton-autre-onglet' ? { data: { ok: true } } : { status: 401 });

    const res = await mod.api.get('/admin/avis');

    expect(res.data.ok).toBe(true);
    expect(appelsRefresh()).toHaveLength(0);
    expect(useAuthStore.getState()).toMatchObject({ token: 'jeton-autre-onglet', refreshToken: 'rt-autre' });
  });

  it('refresh refusé parce qu’un autre onglet vient de faire tourner le refresh token → pas de déconnexion', async () => {
    repondre = (config) => {
      if (config.url === '/auth/refresh') {
        // Pendant l'appel, l'autre onglet a gagné la course et enregistré
        // sa nouvelle session ; notre ancien refresh token est révoqué.
        ecrireStockage('jeton-gagnant', 'rt-gagnant');
        return { status: 401, data: { message: 'Refresh token invalide ou révoqué' } };
      }
      return jeton(config) === 'jeton-gagnant' ? { data: { ok: true } } : { status: 401 };
    };

    const res = await mod.api.get('/admin/avis');

    expect(res.data.ok).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({ token: 'jeton-gagnant', refreshToken: 'rt-gagnant' });
  });

  it('événement `storage` sur la clé de session : le store relit le stockage', async () => {
    ecrireStockage('depuis-autre-onglet', 'rt-x');
    window.dispatchEvent(new StorageEvent('storage', { key: CLE }));
    await vi.waitFor(() => expect(useAuthStore.getState().token).toBe('depuis-autre-onglet'));
  });

  it('déconnexion dans un autre onglet : propagée', async () => {
    window.localStorage.setItem(CLE, JSON.stringify({ state: { user: null, token: null, refreshToken: null }, version: 0 }));
    window.dispatchEvent(new StorageEvent('storage', { key: CLE }));
    await vi.waitFor(() => expect(useAuthStore.getState().token).toBeNull());
  });

  it('événement `storage` sur une autre clé : ignoré', async () => {
    ecrireStockage('ne-doit-pas-etre-lu', 'rt-y');
    window.dispatchEvent(new StorageEvent('storage', { key: 'autre-cle' }));
    await attendre(10);
    expect(useAuthStore.getState().token).toBe('vieux');
  });
});

describe('renouvelerJeton (export direct)', () => {
  it('renvoie le nouveau jeton et le stocke', async () => {
    repondre = () => ({ data: { token: 'neuf', refreshToken: 'rt-2' } });
    await expect(mod.renouvelerJeton('vieux')).resolves.toBe('neuf');
    expect(useAuthStore.getState().refreshToken).toBe('rt-2');
  });

  it('réponse incomplète du back (sans refreshToken) → null, ancien jeton jamais écrasé par undefined', async () => {
    repondre = () => ({ data: { token: 'neuf' } });
    await expect(mod.renouvelerJeton('vieux')).resolves.toBeNull();
    expect(useAuthStore.getState().refreshToken).toBe('rt-1');
  });
});
