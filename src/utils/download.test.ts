import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob, messageErreurTelechargement } from './download';

/**
 * Téléchargements (étiquettes PDF / ZPL, exports, rapports). Rend impossible :
 *  - un message d'erreur figé (« Impossible de télécharger ») alors que le
 *    back a expliqué la raison : en `responseType: 'blob'`, son JSON
 *    `{ message }` arrive lui aussi en Blob et doit être relu ;
 *  - un téléchargement annulé par une URL temporaire révoquée avant que le
 *    navigateur ne l'ait suivie.
 */
describe('messageErreurTelechargement', () => {
  it('lit le message JSON du back contenu dans un Blob', async () => {
    const err = { response: { status: 404, data: new Blob([JSON.stringify({ success: false, message: 'Colis introuvable' })]) } };
    await expect(messageErreurTelechargement(err, 'défaut')).resolves.toBe('Colis introuvable');
  });

  it('lit un message JSON ordinaire', async () => {
    await expect(messageErreurTelechargement({ response: { status: 400, data: { message: 'Statut invalide' } } }, 'défaut'))
      .resolves.toBe('Statut invalide');
  });

  it('Blob illisible : message par défaut ; 429 : message dédié', async () => {
    await expect(messageErreurTelechargement({ response: { status: 500, data: new Blob(['<html>']) } }, 'défaut')).resolves.toBe('défaut');
    await expect(messageErreurTelechargement({ response: { status: 429, data: new Blob(['Too many']) } }, 'défaut'))
      .resolves.toBe('Trop de requêtes. Réessayez dans quelques minutes.');
  });

  it('aucune réponse : précise que le serveur est injoignable', async () => {
    await expect(messageErreurTelechargement(new Error('Network Error'), 'Export impossible'))
      .resolves.toBe('Export impossible (serveur injoignable ou délai dépassé)');
  });
});

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom n'implémente ni les URL d'objets ni la navigation sur clic de lien.
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/123');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clique un lien avec le nom de fichier, ne laisse rien dans le DOM', () => {
    const cliques: { download: string; href: string }[] = [];
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      cliques.push({ download: this.download, href: this.href });
    });
    downloadBlob(new Blob(['x']), 'etiquette-NAN-1.pdf');
    expect(cliques).toEqual([{ download: 'etiquette-NAN-1.pdf', href: 'blob:http://localhost/123' }]);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('révoque l’URL temporaire APRÈS le clic, pas dans la foulée', () => {
    downloadBlob(new Blob(['x']), 'export.csv');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/123');
  });
});
