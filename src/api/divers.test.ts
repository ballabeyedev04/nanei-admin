import { describe, it, expect } from 'vitest';
import { api } from './axios';
import { messagesApi } from './messages';
import { rapportsApi } from './rapports';
import { auditLogsApi } from './auditLogs';
import { etiquettesApi } from './etiquettes';
import { exportApi } from './export';
import { intercepter } from '@/test/axiosFactice';

/**
 * Contrat des petits clients d'API avec le back : messages
 * (routes/admin/messageClient.admin.route.js), rapports (rapport.route.js),
 * journal d'audit (auditlog.route.js), étiquettes (etiquette.route.js) et
 * exports (export.route.js). Rend impossible : une réponse lue sous un autre
 * champ que `reponse`, des filtres d'audit en camelCase (ignorés par le back,
 * qui lit admin_id / date_debut / date_fin), un téléchargement de fichier
 * reçu en texte (PDF / ZPL / XLSX corrompus) ou coupé à 15 s.
 */
describe('messagesApi', () => {
  it('list : GET /admin/messages avec page, limit, q', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true, data: [] } }));
    await messagesApi.list({ page: 1, limit: 20, q: 'colis' });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/messages', params: { page: 1, limit: 20, q: 'colis' } });
  });

  it('stats : GET /admin/messages/stats, total sous `total`', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true, total: 3 } }));
    const res = await messagesApi.stats();
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/messages/stats' });
    expect(res.data.total).toBe(3);
  });

  it('repondre : POST /admin/messages/:id/repondre { reponse }', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true } }));
    await messagesApi.repondre('m1', 'Bonjour');
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/messages/m1/repondre', corps: { reponse: 'Bonjour' } });
  });
});

describe('rapportsApi', () => {
  it('list : GET /admin/rapports, liste sous `rapports`', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true, rapports: [{ filename: 'rapport-2026-09.pdf' }] } }));
    const res = await rapportsApi.list({ page: 1, limit: 20 });
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/rapports', params: { page: 1, limit: 20 } });
    expect(res.data.rapports?.[0].filename).toBe('rapport-2026-09.pdf');
  });

  it('download : GET /admin/rapports/:filename en blob', async () => {
    const reseau = intercepter(api, () => ({ data: new Blob(['%PDF']) }));
    await rapportsApi.download('rapport-2026-09.pdf');
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/rapports/rapport-2026-09.pdf' });
    expect(reseau.dernier().config.responseType).toBe('blob');
  });

  it('download : nom de fichier encodé dans le chemin', async () => {
    const reseau = intercepter(api, () => ({ data: new Blob(['%PDF']) }));
    await rapportsApi.download('rapport #1.pdf');
    expect(reseau.dernier().url).toBe('/admin/rapports/rapport%20%231.pdf');
  });

  it('generate : POST /admin/rapports/generer avec un délai long (génération PDF)', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true } }));
    await rapportsApi.generate();
    expect(reseau.dernier()).toMatchObject({ methode: 'POST', url: '/admin/rapports/generer' });
    expect(reseau.dernier().config.timeout).toBe(120_000);
  });
});

describe('auditLogsApi', () => {
  it('list : GET /admin/audit-logs avec les filtres en snake_case du back', async () => {
    const reseau = intercepter(api, () => ({ data: { success: true, logs: [], total: 0, page: 1, pages: 1 } }));
    const filtres = { admin_id: 'a1', action: 'UPDATE', entite: 'Colis', date_debut: '2026-10-01', date_fin: '2026-10-11', page: 2, limit: 20 };
    await auditLogsApi.list(filtres);
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/audit-logs', params: filtres });
  });
});

describe('etiquettesApi', () => {
  it('telecharger : GET /admin/etiquettes/:colisId en blob (PDF), délai 60 s', async () => {
    const reseau = intercepter(api, () => ({ data: new Blob(['%PDF']) }));
    await etiquettesApi.telecharger('c1');
    const appel = reseau.dernier();
    expect(appel).toMatchObject({ methode: 'GET', url: '/admin/etiquettes/c1' });
    expect(appel.params).toBeUndefined();
    expect(appel.config).toMatchObject({ responseType: 'blob', timeout: 60_000 });
  });

  it('telechargerZPL : même route avec ?format=zpl', async () => {
    const reseau = intercepter(api, () => ({ data: new Blob(['^XA']) }));
    await etiquettesApi.telechargerZPL('c1');
    expect(reseau.dernier()).toMatchObject({ methode: 'GET', url: '/admin/etiquettes/c1', params: { format: 'zpl' } });
    expect(reseau.dernier().config.responseType).toBe('blob');
  });
});

describe('exportApi', () => {
  it.each([
    ['colis', '/admin/export/colis'],
    ['paiements', '/admin/export/paiements'],
  ] as const)('%s : GET %s avec format + statut / date_debut / date_fin, en blob', async (fn, chemin) => {
    const reseau = intercepter(api, () => ({ data: new Blob(['a;b']) }));
    await exportApi[fn]('xlsx', { statut: 'livre', date_debut: '2026-10-01', date_fin: '2026-10-11' });
    const appel = reseau.dernier();
    expect(appel).toMatchObject({
      methode: 'GET', url: chemin, params: { format: 'xlsx', statut: 'livre', date_debut: '2026-10-01', date_fin: '2026-10-11' },
    });
    expect(appel.config).toMatchObject({ responseType: 'blob', timeout: 60_000 });
  });
});
