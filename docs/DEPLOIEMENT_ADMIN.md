# Déploiement de l'interface d'administration (admin.app-nanei.com)

Chaîne : `.github/workflows/deploy.yml` (déploiement) et
`.github/workflows/rollback-admin.yml` (retour arrière manuel).
Scripts : dossier `deploy/`.

## En bref

| Je veux… | Je fais… |
|---|---|
| Déployer | `git push origin main`, puis j'approuve le job « 5 · Approbation & mise en service » dans l'onglet Actions |
| Tout vérifier sans rien mettre en ligne | Actions > « Admin — déploiement » > *Run workflow* (case « Essai à blanc » cochée) |
| Revenir à la version d'avant | Actions > « Admin — retour arrière » > *Run workflow* (`precedente`) |
| Voir les versions présentes sur le serveur | Actions > « Admin — retour arrière » > *Run workflow*, case « Lister seulement » |

**Ordre de déploiement : le back d'abord, l'admin ensuite.** La chaîne refuse de
déployer l'admin si le back en ligne n'expose pas la version d'API exigée.

## La chaîne, étape par étape

```
1. Contrôles d'entrée ─┬─ 2a. Analyse (lint, types, scripts) ─┐
                       ├─ 2b. Tests ───────────────────────────┼─ 3. Construction & contrôle du livrable
                       ├─ 2c. Sécurité ────────────────────────┤               │
                       └─ 2d. Compatibilité du back ───────────┘   4. Test de démarrage (Nginx + navigateur)
                                                                               │
                                    5. ✋ Approbation → mise en service atomique + vérification
                                       (retour arrière automatique si la vérification échoue)
                                                                               │
                                                                          6. Bilan
```

Chaque étape écrit son résultat dans le **résumé** de l'exécution (onglet
Actions > l'exécution > *Summary*). Un seul déploiement à la fois
(`concurrency`, sans annulation de celui en cours).

1. **Contrôles d'entrée** — le commit est bien sur `main` ; mode déploiement
   (push) ou essai à blanc (lancement manuel) ; lecture de `API_VERSION_MIN`
   dans `src/config/apiVersion.ts` ; présence et format des secrets.
2. En parallèle :
   - **2a · Analyse** — `npm run lint` (ESLint, **zéro erreur**),
     `npm run typecheck` (types de l'application, des tests et de la
     configuration), `bash -n` + ShellCheck sur les scripts de `deploy/`.
   - **2b · Tests** — `vitest run` (bloquant), puis les tests des scripts de
     déploiement (`deploy/tests/`, dossiers temporaires simulant `/var/www`,
     dont les tests de verrou et d'atomicité qui ne tournent que sous Linux).
   - **2c · Sécurité** — Gitleaks (secrets oubliés, conteneur épinglé,
     exceptions dans `.gitleaks.toml`) ; `npm audit --omit=dev --audit-level=high`
     (**bloquant** : dépendances embarquées dans le site) ; OSV-Scanner sur
     `package-lock.json` (non bloquant : signale aussi les outils de construction).
   - **2d · Compatibilité du back** — appel de `<origine de VITE_API_URL>/health`
     (voir « Compatibilité avec le back »).
3. **Construction & contrôle du livrable** — `npm run build` avec
   `VITE_API_URL` (secret) et `VITE_APP_VERSION` = sha du commit (aucun `.env`
   écrit) ; `dist/version.json` = `{ "version": "<sha>", "date": "<ISO>", "apiMin": <entier> }` ;
   `deploy/controler-dist.sh` vérifie : `index.html` et `version.json`, sha et
   URL d'API présents dans le JavaScript, aucun fichier ou code de test
   (vitest, testing-library, jsdom), aucune carte de sources, aucune adresse
   locale avec port ou chemin, aucun motif de clé/jeton, toutes les ressources
   locales d'`index.html` présentes, taille < 8 Mo. Archive
   `nanei-admin-<sha>.tar.gz` reproductible + `SHA256SUMS.txt`, en artefact
   `admin-dist` (90 jours). **Construit une seule fois** : c'est cette archive
   qui est testée puis mise en service.
4. **Test de démarrage** — l'archive est installée par le **vrai script de mise
   en service** dans un dossier temporaire, puis servie par **Nginx en
   conteneur avec le fichier de configuration de production**
   (`deploy/nginx-admin-commun.conf`). Vérifiés : `version.json` = sha,
   `/` et `/nanei/admin/login` en 200, script principal en 200, `no-cache` sur
   la page et `version.json`, `immutable` sur `/assets/`, 404 pour une
   ressource absente, en-têtes de sécurité ; enfin **Chrome sans interface**
   ouvre `/nanei/admin/login` : la page de connexion doit être rendue et
   `<html data-version>` porter le sha.
5. **Approbation & mise en service** (environnement `production`, sauté en
   essai à blanc) — après votre approbation : intégrité de l'archive, nouvelle
   vérification du back, connexion SSH (empreinte du serveur vérifiée), envoi
   de l'archive et du script dans un dossier temporaire du serveur,
   **installation + bascule atomique** (`deploy/mettre-en-service.sh installer`),
   puis **vérification en ligne** (`deploy/verifier-en-ligne.sh`) :
   `https://admin.app-nanei.com/version.json` (paramètre anti-cache +
   en-têtes `no-cache`) doit annoncer le sha déployé, et `/` et
   `/nanei/admin/login` répondre 200 (6 essais espacés de 5 s).
   **Si la vérification échoue : retour arrière automatique** vers la version
   précédente (la version ratée est supprimée du serveur), nouvelle
   vérification, puis échec du job avec un message clair.
   En cas de succès : tag `admin-v<AAAAMMJJ-HHMMSS>-<sha court>` + Release
   GitHub (archive, sommes, liste des changements).
6. **Bilan** (toujours exécuté) — tableau de toutes les étapes et état final :
   déployée, retour arrière, refus du back, installation refusée, intervention
   requise.

## Compatibilité avec le back (ordre de déploiement)

- Le back publie `GET /health` → `{ "status": "OK", "db": "ok", "version": "<sha>", "api": <entier> }`.
  L'URL est l'**origine** de `VITE_API_URL`, sans `/nanei` :
  `https://api.app-nanei.com/nanei` → `https://api.app-nanei.com/health`.
- L'admin déclare `API_VERSION_MIN` dans `src/config/apiVersion.ts` (aujourd'hui **2**).
- La chaîne refuse de déployer (« déployer d'abord le back ») si `/health` est
  injoignable, ne répond pas 200, `status` ≠ `OK`, `db` ≠ `ok`, `api` absent,
  ou `api` < `API_VERSION_MIN`. Contrôle fait deux fois : en 2d (échec rapide)
  et juste avant la bascule (l'approbation a pu attendre).

**Règle d'incrément**

1. Le **back** incrémente `api` (entier) quand il ajoute ou modifie une route,
   un champ ou un comportement dont un client peut dépendre. Une correction
   interne ne change pas `api`.
2. L'**admin** monte `API_VERSION_MIN` à cette valeur **dans le même
   changement** que le code qui utilise la nouveauté, jamais avant.
3. On déploie le back, on vérifie `/health`, puis on déploie l'admin. Si
   l'ordre est inversé, la chaîne de l'admin s'arrête avant toute modification
   du serveur.
4. `API_VERSION_MIN` reste un entier littéral sur une ligne
   (`export const API_VERSION_MIN = 2;`) : la chaîne le lit tel quel (un test
   Vitest le garantit).

## Disposition sur le serveur et mise en service atomique

```
/var/www/nanei-admin            → lien symbolique vers la version servie
/var/www/nanei-admin-releases/
    00000000-000000-initiale/   ← ancien dossier, conservé lors de la migration
    20261012-153000-abc1234/    ← une version par dossier, jamais modifiée
    20261013-091500-def5678/
    .verrou                     ← verrou flock : une mise en service à la fois
```

`deploy/mettre-en-service.sh` (copié sur le serveur à chaque exécution) :

- vérifie la somme SHA-256 de l'archive, extrait dans un dossier temporaire,
  contrôle `index.html`, `version.json` (sha cohérent avec le nom de version)
  et l'absence de lien symbolique, puis le renomme en dossier de version ;
- bascule : nouveau lien créé à côté (`ln -sfn`) puis renommé par-dessus
  l'ancien (`mv -T`) — opération atomique, chaque requête voit l'ancienne
  ou la nouvelle version ;
- **migration unique** : si `/var/www/nanei-admin` est encore un vrai dossier
  (déploiements scp d'avant), il devient `00000000-000000-initiale` et le lien
  prend sa place par deux renommages consécutifs sur le même système de
  fichiers (coupure de quelques microsecondes) ; il reste disponible pour un
  retour arrière ;
- garde les **5** dernières versions (jamais la version servie ni la
  précédente) ;
- `flock` empêche deux mises en service (ou un déploiement et un retour
  arrière) simultanées ; attente maximale 10 minutes ;
- commandes : `installer`, `revenir [nom|precedente] [--abandonner nom]`,
  `actuelle`, `lister`.

## Configuration unique — GitHub

1. **Secrets** (Settings > Secrets and variables > Actions > *Repository secrets*) :

   | Secret | Contenu | Statut |
   |---|---|---|
   | `VITE_API_URL` | `https://api.app-nanei.com/nanei` (sans `/` final) | existant |
   | `VPS_HOST` | adresse du serveur | existant |
   | `VPS_USER` | utilisateur SSH de déploiement | existant |
   | `VPS_SSH_KEY` | clé privée SSH de cet utilisateur | existant |
   | `VPS_KNOWN_HOSTS` | empreinte(s) du serveur, format `known_hosts` | **à ajouter (recommandé)** |

   `VPS_KNOWN_HOSTS` : depuis votre poste, `ssh-keyscan -H <VPS_HOST>`, puis
   **comparer** l'empreinte (`ssh-keygen -lf <fichier>`) avec celle affichée sur
   le serveur (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) avant de
   coller les lignes dans le secret. Sans ce secret, la chaîne accepte
   l'empreinte lue à la connexion et affiche un avertissement ⚠️ dans le résumé.

   Variable facultative (*Variables*) : `VPS_PORT` si SSH n'écoute pas sur 22.

2. **Environnement `production`** (Settings > Environments > *New environment*
   → `production`) :
   - *Required reviewers* : ajoutez les personnes autorisées à mettre en ligne
     (vous-même au minimum) ; cochez *Prevent self-review* si plusieurs
     relecteurs sont disponibles ;
   - *Deployment branches and tags* : *Selected branches* → `main` ;
   - les secrets peuvent rester au niveau du dépôt (le job « 2d » et l'essai à
     blanc ont besoin de `VITE_API_URL` hors environnement).

   Sans relecteur, le job 5 démarre sans attendre : ajoutez-les **avant** le
   premier push.

3. **Actions** (Settings > Actions > General) : *Workflow permissions* peut
   rester en lecture seule ; le job 5 demande lui-même `contents: write` pour
   le tag et la Release.

## Configuration unique — serveur

1. **Droits de l'utilisateur de déploiement** (`VPS_USER`) : il doit pouvoir
   écrire dans `/var/www` (le lien `/var/www/nanei-admin` y est remplacé à
   chaque bascule, et `/var/www/nanei-admin-releases` y est créé). S'il n'est
   pas `root` :

   ```bash
   sudo mkdir -p /var/www/nanei-admin-releases
   sudo chown "$VPS_USER": /var/www/nanei-admin-releases
   # écriture dans /var/www : soit propriétaire, soit groupe dédié
   sudo chgrp "$VPS_USER" /var/www && sudo chmod g+w /var/www
   ```

   Le script le vérifie et s'arrête avec un message clair sinon.
   `/var/www/nanei-admin` et `/var/www/nanei-admin-releases` doivent être sur
   le même système de fichiers (cas normal).

2. **Outils** : `bash`, `flock` (paquet `util-linux`), `sha256sum`, `tar`,
   `gzip` — présents par défaut sur Ubuntu/Debian.

3. **Première bascule** : rien à faire à la main. Au premier déploiement, le
   script déplace le dossier actuel `/var/www/nanei-admin` en
   `/var/www/nanei-admin-releases/00000000-000000-initiale` et crée le lien.
   Pour s'y préparer sans risque : lancer d'abord un **essai à blanc**.

4. **Nginx** — la configuration de l'admin n'est pas dans ce dépôt ; un modèle
   l'est : `deploy/nginx-admin.conf` (bloc server) +
   `deploy/nginx-admin-commun.conf` (règles communes, **testées par la chaîne**).
   - `root /var/www/nanei-admin;` **inchangé** : Nginx suit les liens
     symboliques par défaut. Vérifiez que la configuration ne contient pas
     `disable_symlinks` (`sudo nginx -T | grep -n disable_symlinks` ne doit
     rien afficher, ou `off`).
   - Si `open_file_cache` est activé, la bascule peut n'être vue qu'après
     `open_file_cache_valid` (60 s par défaut) : la vérification en ligne
     réessaie 30 s ; préférez le désactiver pour l'admin.
   - Cache : `index.html`, les routes de l'application et `version.json` en
     `Cache-Control: no-cache` ; `/assets/` (noms hachés) en
     `public, max-age=31536000, immutable` ; une ressource absente répond 404.
     Sans cela, un navigateur garde l'ancien `index.html` et la chaîne ne peut
     pas vérifier la version en ligne.
   - SPA : `try_files $uri /index.html;`.
   - En-têtes : `X-Content-Type-Options`, `X-Frame-Options`,
     `Referrer-Policy`, `Permissions-Policy`, HSTS. Une
     `Content-Security-Policy` est proposée en commentaire : à essayer d'abord
     en `Content-Security-Policy-Report-Only`.

   Application manuelle (une fois, puis à chaque modification de
   `deploy/nginx-admin-commun.conf`) :

   ```bash
   sudo nginx -T > ~/nginx-avant.txt                       # sauvegarde de l'existant
   sudo cp deploy/nginx-admin-commun.conf /etc/nginx/snippets/nanei-admin-commun.conf
   sudoedit /etc/nginx/sites-available/<fichier de l'admin>  # d'après deploy/nginx-admin.conf,
                                                             # en gardant les certificats existants
   sudo nginx -t && sudo systemctl reload nginx
   curl -sI https://admin.app-nanei.com/nanei/admin/login | grep -i cache-control   # no-cache
   ```

## Retour arrière manuel

Actions > **« Admin — retour arrière »** > *Run workflow* :

- `version` : `precedente` (la version installée juste avant celle en ligne)
  ou un nom exact, ex. `20261012-153000-abc1234` (liste dans le résumé de
  chaque exécution, ou cocher « Lister seulement ») ;
- `raison` : inscrite dans le résumé.

Le job utilise l'environnement `production` (même approbation), rebascule le
lien (instantané, rien n'est reconstruit ni supprimé), puis vérifie
`version.json` et les routes en ligne. La version initiale
(`00000000-000000-initiale`, antérieure à cette chaîne) n'a pas de
`version.json` : seules les routes sont alors vérifiées.

En dernier recours, sur le serveur :

```bash
ls /var/www/nanei-admin-releases/
cd /var/www && ln -sfn nanei-admin-releases/<version> .nanei-admin.tmp && mv -T .nanei-admin.tmp nanei-admin
```

## Exceptions de sécurité documentées

- `npm audit` (toutes dépendances) signale des failles **hautes** dans la
  chaîne de construction de **Tailwind CSS 3** (`braces`, `micromatch`,
  `chokidar`, `fast-glob`) et une faille faible d'`esbuild` (serveur de
  développement sous Windows). Ce sont des **devDependencies** : elles servent
  à construire, ne sont jamais envoyées aux navigateurs, et le correctif impose
  Tailwind 4 (migration majeure). Elles restent visibles (non bloquantes) via
  OSV-Scanner ; le contrôle bloquant porte sur `npm audit --omit=dev`
  (0 faille au 12/10/2026, après mise à jour d'axios 1.20.0 et
  react-router 7.18.4).

## Dépannage

| Message | Cause probable | Action |
|---|---|---|
| « déployer d'abord le back » | `/health` sans `api`, ou `api` < `API_VERSION_MIN` | déployer le back, vérifier `/health`, relancer |
| « santé du back KO » | back ou base en panne | rétablir le back avant l'admin |
| « n'est pas modifiable par l'utilisateur » | droits sur `/var/www` | voir « Configuration unique — serveur » |
| « une autre mise en service est en cours » | verrou tenu > 10 min | vérifier qu'aucun déploiement ne tourne ; le verrou se libère à la fin du processus |
| « pointe vers … hors de nanei-admin-releases » | lien modifié à la main | corriger le lien sur le serveur |
| Retour arrière automatique | la nouvelle version ne répond pas (Nginx, cache, erreur JS) | lire l'étape « Vérification en ligne » ; corriger puis redéployer |

## Vérifier en local

```bash
npm run lint && npm run typecheck && npm test && npm run build
bash deploy/tests/tester-mise-en-service.sh     # Git Bash : liens natifs, verrou simulé
bash deploy/tests/tester-verifications.sh       # serveur factice Node
```
