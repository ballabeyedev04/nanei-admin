// Serveur HTTP factice pour les tests des scripts de déploiement.
//   node serveur-factice.mjs <port> <mode> [dossier]
// Modes « sante-* » : simule GET /health du back.
// Modes « spa* »    : sert [dossier] comme Nginx (route inconnue → index.html).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const [port, mode, dossier] = process.argv.slice(2);

const SANTE = {
  'sante-ok':        [200, { status: 'OK', db: 'ok', version: 'abc1234', api: 2 }],
  'sante-api3':      [200, { status: 'OK', db: 'ok', version: 'abc1234', api: 3 }],
  'sante-api1':      [200, { status: 'OK', db: 'ok', version: 'abc1234', api: 1 }],
  'sante-sans-api':  [200, { status: 'OK', db: 'ok' }],
  'sante-db-ko':     [503, { status: 'ERROR', db: 'ko', version: 'abc1234', api: 2 }],
  'sante-statut-ko': [200, { status: 'DEGRADED', db: 'ok', version: 'abc1234', api: 2 }],
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (mode.startsWith('sante')) {
    if (chemin !== '/health') { res.writeHead(404).end(); return; }
    if (mode === 'sante-html') { res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>vieux back</html>'); return; }
    const [code, corps] = SANTE[mode];
    res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(corps));
    return;
  }
  // Chemin relatif au dossier servi, sans « .. » ni séparateur initial.
  const sur = chemin.split('/').filter((p) => p && p !== '..').join('/');
  try {
    const contenu = await readFile(join(dossier, sur || 'index.html'));
    res.writeHead(200, { 'Content-Type': TYPES[extname(sur)] ?? 'application/octet-stream' }).end(contenu);
  } catch {
    if (mode === 'spa' && !chemin.startsWith('/assets/') && chemin !== '/version.json') {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(join(dossier, 'index.html')));
    } else {
      res.writeHead(404).end('introuvable');
    }
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`prêt ${port} ${mode}`));
