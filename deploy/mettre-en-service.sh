#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Nanei admin — mise en service atomique sur le serveur, avec retour arrière
# ═══════════════════════════════════════════════════════════════════════════
#
#  Copié sur le serveur à chaque déploiement (avec l'archive) par
#  .github/workflows/deploy.yml et rollback-admin.yml. Procédure complète :
#  docs/DEPLOIEMENT_ADMIN.md.
#
#  Disposition sur le serveur (Nginx sert toujours `root /var/www/nanei-admin`) :
#
#    /var/www/nanei-admin            → lien symbolique vers la version servie
#    /var/www/nanei-admin-releases/
#        20261012-153000-abc1234/    ← une version = un dossier, jamais modifié
#        20261013-091500-def5678/
#        .verrou                     ← verrou (flock) : une mise en service à la fois
#
#  Commandes :
#    installer <archive.tar.gz> <sha256> <nom-version>
#        Vérifie la somme, extrait dans un nouveau dossier de version, puis
#        bascule le lien d'un seul coup (rename atomique). Migration unique :
#        si /var/www/nanei-admin est encore un vrai dossier, il devient la
#        version « 00000000-000000-initiale ». Garde les NANEI_CONSERVER (5)
#        dernières versions.
#    revenir [<nom-version> | precedente] [--abandonner <nom-version>]
#        Rebascule le lien vers une version encore présente (par défaut : celle
#        qui précède la version servie). --abandonner supprime ensuite la
#        version ratée (retour arrière automatique après une vérification KO).
#    actuelle   Affiche la version servie.
#    lister     Liste les versions présentes (* = servie).
#
#  Sortie : le journal va sur stderr ; stdout ne reçoit que des lignes
#  CLE=valeur (VERSION_ACTUELLE, VERSION_PRECEDENTE, SHA_ACTUEL) lues par la chaîne.
#
#  Variables (tests uniquement, valeurs de production par défaut) :
#    NANEI_WWW=/var/www  NANEI_CONSERVER=5  NANEI_ATTENTE_VERROU=600 (secondes)

set -Eeuo pipefail
umask 022
export LC_ALL=C

WWW="${NANEI_WWW:-/var/www}"
NOM_LIEN="nanei-admin"
NOM_VERSIONS="nanei-admin-releases"
LIEN="$WWW/$NOM_LIEN"
VERSIONS="$WWW/$NOM_VERSIONS"
CONSERVER="${NANEI_CONSERVER:-5}"
ATTENTE_VERROU="${NANEI_ATTENTE_VERROU:-600}"
# <AAAAMMJJ>-<HHMMSS>-<sha court ou « initiale »> : l'ordre alphabétique est
# l'ordre chronologique, et rien d'autre (fichier temporaire, verrou) n'y ressemble.
MOTIF_VERSION='^[0-9]{8}-[0-9]{6}-[A-Za-z0-9]+$'

journal() { echo "[mise-en-service] $*" >&2; }
erreur() { echo "[mise-en-service] ERREUR : $*" >&2; exit 1; }

nom_valide() { [[ "$1" =~ $MOTIF_VERSION ]]; }

# ── Prérequis ──────────────────────────────────────────────────────────────
verifier_outils() {
  local outil
  for outil in flock sha256sum tar gzip readlink mv ln find sort stat; do
    command -v "$outil" > /dev/null 2>&1 || erreur "commande « $outil » introuvable sur le serveur"
  done
  [ -d "$WWW" ] || erreur "$WWW n'existe pas"
  [ -w "$WWW" ] || erreur "$WWW n'est pas modifiable par l'utilisateur $(id -un) : le lien $LIEN y est remplacé à chaque mise en service (voir docs/DEPLOIEMENT_ADMIN.md, « Configuration du serveur »)"
}

# Un seul processus à la fois (deux déploiements, ou un déploiement et un
# retour arrière manuel). Le verrou est libéré automatiquement à la fin du
# processus, même en cas d'erreur (descripteur 9 fermé par le noyau).
verrouiller() {
  mkdir -p "$VERSIONS"
  exec 9> "$VERSIONS/.verrou"
  journal "attente du verrou (au plus ${ATTENTE_VERROU} s)…"
  flock -w "$ATTENTE_VERROU" 9 || erreur "une autre mise en service est en cours depuis plus de ${ATTENTE_VERROU} s (verrou $VERSIONS/.verrou)"
}

# ── Lecture de l'état ──────────────────────────────────────────────────────
# Nom de la version servie (vide si le lien n'existe pas encore).
version_actuelle() {
  if [ -L "$LIEN" ]; then
    local cible nom
    cible="$(readlink "$LIEN")"
    nom="${cible##*/}"
    case "$cible" in
      "$NOM_VERSIONS/$nom" | "$VERSIONS/$nom") ;;
      *) erreur "$LIEN pointe vers « $cible », hors de $VERSIONS : corrigez à la main avant de continuer" ;;
    esac
    echo "$nom"
  elif [ -e "$LIEN" ]; then
    echo "__dossier_reel__"
  fi
}

# Versions présentes, de la plus ancienne à la plus récente.
lister_versions() {
  [ -d "$VERSIONS" ] || return 0
  find "$VERSIONS" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | grep -E "$MOTIF_VERSION" | sort || true
}

# Sha publié dans version.json d'une version (vide si illisible).
sha_de() {
  sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$VERSIONS/$1/version.json" 2> /dev/null | head -1
}

# Version qui précède $1 dans l'ordre chronologique (vide s'il n'y en a pas).
version_avant() {
  local precedente="" v
  while IFS= read -r v; do
    [ "$v" = "$1" ] && break
    precedente="$v"
  done < <(lister_versions)
  echo "$precedente"
}

# ── Bascule ────────────────────────────────────────────────────────────────
# Le nouveau lien est créé à côté, puis renommé PAR-DESSUS l'ancien : rename(2)
# est atomique, chaque requête voit soit l'ancienne version, soit la nouvelle.
# Cible RELATIVE (nanei-admin-releases/<nom>) : le lien reste juste si /var/www
# est déplacé ou monté ailleurs.
basculer() {
  local nom="$1" tmp="$WWW/.$NOM_LIEN.bascule.$$"
  [ -f "$VERSIONS/$nom/index.html" ] || erreur "version « $nom » absente ou incomplète (pas d'index.html)"
  ln -sfn "$NOM_VERSIONS/$nom" "$tmp"
  if ! mv -T "$tmp" "$LIEN"; then
    rm -f -- "$tmp"
    erreur "impossible de remplacer $LIEN"
  fi
  journal "lien basculé : $LIEN → $NOM_VERSIONS/$nom"
}

# Migration unique : /var/www/nanei-admin est encore un vrai dossier (ancienne
# copie scp). Il devient la version « 00000000-000000-initiale » et le lien prend
# sa place : deux renommages consécutifs sur le même système de fichiers, la
# coupure ne dure que l'intervalle entre les deux (quelques microsecondes).
migrer_puis_basculer() {
  local nouvelle="$1" initiale tmp="$WWW/.$NOM_LIEN.bascule.$$"
  # Horodatage nul : la version initiale est la plus ANCIENNE dans l'ordre des
  # noms (un horodatage réel la classerait après la nouvelle version, nommée
  # avant la migration, et « revenir précédente » ne la trouverait pas).
  initiale="00000000-000000-initiale"
  [ ! -e "$VERSIONS/$initiale" ] || erreur "$VERSIONS/$initiale existe déjà alors que $LIEN est un vrai dossier : situation à examiner à la main"
  [ "$(stat -c %d "$LIEN")" = "$(stat -c %d "$VERSIONS")" ] \
    || erreur "$LIEN et $VERSIONS ne sont pas sur le même système de fichiers : le déplacement ne serait pas instantané"
  [ -f "$VERSIONS/$nouvelle/index.html" ] || erreur "version « $nouvelle » incomplète"
  journal "migration : le dossier réel $LIEN devient la version $initiale"
  ln -sfn "$NOM_VERSIONS/$nouvelle" "$tmp"
  mv -T "$LIEN" "$VERSIONS/$initiale" || { rm -f -- "$tmp"; erreur "impossible de déplacer $LIEN"; }
  if ! mv -T "$tmp" "$LIEN"; then
    # Remise en place immédiate de l'ancien dossier : le site reste servi.
    mv -T "$VERSIONS/$initiale" "$LIEN" || true
    rm -f -- "$tmp"
    erreur "impossible de créer le lien $LIEN : ancien dossier remis en place"
  fi
  journal "lien créé : $LIEN → $NOM_VERSIONS/$nouvelle"
  echo "$initiale"
}

# ── Rétention ──────────────────────────────────────────────────────────────
# Garde les $CONSERVER versions les plus récentes ; ne supprime jamais la
# version servie ni celle qui la précède (cible du retour arrière).
nettoyer() {
  local actuelle="$1" precedente="$2" v
  local -a toutes
  mapfile -t toutes < <(lister_versions)
  local a_supprimer=$(( ${#toutes[@]} - CONSERVER ))
  for v in "${toutes[@]}"; do
    [ "$a_supprimer" -gt 0 ] || break
    [ "$v" = "$actuelle" ] && continue
    [ "$v" = "$precedente" ] && continue
    nom_valide "$v" || continue
    journal "suppression de l'ancienne version $v"
    rm -rf -- "${VERSIONS:?}/$v"
    a_supprimer=$(( a_supprimer - 1 ))
  done
}

# ── Commandes ──────────────────────────────────────────────────────────────
cmd_installer() {
  [ "$#" -eq 3 ] || erreur "usage : $0 installer <archive.tar.gz> <sha256> <nom-version>"
  local archive="$1" attendu="$2" nom="$3"
  nom_valide "$nom" || erreur "nom de version invalide : « $nom » (attendu AAAAMMJJ-HHMMSS-<sha>)"
  [[ "$attendu" =~ ^[0-9a-f]{64}$ ]] || erreur "somme SHA-256 attendue invalide : « $attendu »"
  [ -f "$archive" ] || erreur "archive introuvable : $archive"
  if ! [[ "$CONSERVER" =~ ^[0-9]+$ ]] || [ "$CONSERVER" -lt 2 ]; then
    erreur "NANEI_CONSERVER doit valoir au moins 2"
  fi

  verifier_outils

  local calcule
  calcule="$(sha256sum "$archive" | cut -d' ' -f1)"
  [ "$calcule" = "$attendu" ] || erreur "somme SHA-256 de l'archive incorrecte (attendu $attendu, obtenu $calcule) : archive altérée ou incomplète"
  journal "archive intègre (sha256 $calcule)"

  verrouiller

  # Restes d'une mise en service interrompue (sous verrou : aucune autre en cours).
  find "$VERSIONS" -mindepth 1 -maxdepth 1 -name '.extraction-*' -exec rm -rf -- {} +
  find "$WWW" -mindepth 1 -maxdepth 1 -name ".$NOM_LIEN.bascule.*" -type l -delete

  [ ! -e "$VERSIONS/$nom" ] || erreur "la version $nom existe déjà sur le serveur"

  # Variable globale : le piège EXIT la lit après la sortie de la fonction.
  EXTRACTION="$VERSIONS/.extraction-$nom"
  trap 'rm -rf -- "$EXTRACTION"' EXIT
  mkdir "$EXTRACTION"
  # GNU tar refuse les chemins absolus et les « .. » ; --no-same-owner : les
  # fichiers appartiennent à l'utilisateur de déploiement, même lancé en root.
  tar -xzf "$archive" -C "$EXTRACTION" --no-same-owner --no-same-permissions

  [ -f "$EXTRACTION/index.html" ] || erreur "archive invalide : index.html absent"
  [ -f "$EXTRACTION/version.json" ] || erreur "archive invalide : version.json absent"
  if [ -n "$(find "$EXTRACTION" ! -type f ! -type d -print -quit)" ]; then
    erreur "archive invalide : elle contient autre chose que des fichiers et des dossiers (lien symbolique…)"
  fi
  local sha_archive sha_nom="${nom##*-}"
  sha_archive="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$EXTRACTION/version.json" | head -1)"
  case "$sha_archive" in
    "$sha_nom"*) ;;
    *) erreur "version.json annonce « $sha_archive », incohérent avec le nom de version $nom" ;;
  esac
  chmod -R u=rwX,go=rX "$EXTRACTION"
  mv -T "$EXTRACTION" "$VERSIONS/$nom"
  trap - EXIT
  journal "version $nom prête dans $VERSIONS/$nom"

  local precedente
  precedente="$(version_actuelle)"
  if [ "$precedente" = "__dossier_reel__" ]; then
    precedente="$(migrer_puis_basculer "$nom")"
  else
    basculer "$nom"
  fi

  nettoyer "$nom" "$precedente"

  echo "VERSION_PRECEDENTE=$precedente"
  echo "VERSION_ACTUELLE=$nom"
  echo "SHA_ACTUEL=$(sha_de "$nom")"
}

cmd_revenir() {
  local cible="precedente" abandonner=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --abandonner) [ "$#" -ge 2 ] || erreur "--abandonner attend un nom de version"; abandonner="$2"; shift 2 ;;
      -*) erreur "option inconnue : $1" ;;
      *) cible="$1"; shift ;;
    esac
  done
  [ -z "$cible" ] && cible="precedente"

  verifier_outils
  verrouiller

  local actuelle
  actuelle="$(version_actuelle)"
  if [ -z "$actuelle" ] || [ "$actuelle" = "__dossier_reel__" ]; then
    erreur "$LIEN n'est pas encore un lien géré par cette chaîne : aucun retour arrière possible"
  fi

  if [ "$cible" = "precedente" ] || [ "$cible" = "précédente" ]; then
    cible="$(version_avant "$actuelle")"
    [ -n "$cible" ] || erreur "aucune version antérieure à $actuelle sur le serveur"
  fi
  nom_valide "$cible" || erreur "nom de version invalide : « $cible »"
  [ -d "$VERSIONS/$cible" ] || erreur "la version $cible n'est plus sur le serveur (versions présentes : $(lister_versions | tr '\n' ' '))"
  [ "$cible" != "$actuelle" ] || erreur "la version $cible est déjà en service"

  basculer "$cible"

  if [ -n "$abandonner" ]; then
    if nom_valide "$abandonner" && [ "$abandonner" != "$cible" ] && [ -d "$VERSIONS/$abandonner" ]; then
      journal "suppression de la version abandonnée $abandonner"
      rm -rf -- "${VERSIONS:?}/$abandonner"
    else
      journal "version abandonnée « $abandonner » ignorée (absente, invalide ou en service)"
    fi
  fi

  echo "VERSION_PRECEDENTE=$actuelle"
  echo "VERSION_ACTUELLE=$cible"
  echo "SHA_ACTUEL=$(sha_de "$cible")"
}

cmd_actuelle() {
  local actuelle
  actuelle="$(version_actuelle)"
  echo "VERSION_ACTUELLE=$actuelle"
  if [ -n "$actuelle" ] && [ "$actuelle" != "__dossier_reel__" ]; then
    echo "SHA_ACTUEL=$(sha_de "$actuelle")"
  fi
}

cmd_lister() {
  local actuelle v marque
  actuelle="$(version_actuelle)"
  while IFS= read -r v; do
    marque=" "
    [ "$v" = "$actuelle" ] && marque="*"
    echo "$marque $v  (sha $(sha_de "$v"))" >&2
  done < <(lister_versions)
  [ "$actuelle" = "__dossier_reel__" ] && journal "$LIEN est encore un vrai dossier (migration au prochain déploiement)"
  return 0
}

commande="${1:-}"
[ "$#" -gt 0 ] && shift
case "$commande" in
  installer) cmd_installer "$@" ;;
  revenir)   cmd_revenir "$@" ;;
  actuelle)  cmd_actuelle ;;
  lister)    cmd_lister ;;
  *) erreur "commande inconnue « $commande » (installer | revenir | actuelle | lister)" ;;
esac
