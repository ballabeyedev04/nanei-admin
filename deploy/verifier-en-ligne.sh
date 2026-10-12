#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Nanei admin — la version attendue est-elle réellement servie ?
# ═══════════════════════════════════════════════════════════════════════════
#
#  Usage : deploy/verifier-en-ligne.sh <URL de l'admin> [<sha attendu>]
#    ex.   deploy/verifier-en-ligne.sh https://admin.app-nanei.com 3f2c…
#
#  Vérifie, en contournant les caches (paramètre de requête unique + en-têtes
#  no-cache) :
#    1. /version.json annonce le sha attendu (si fourni) ;
#    2. la page d'accueil et une route profonde de la SPA
#       (/nanei/admin/login) répondent 200 avec la page de l'application ;
#    3. le script principal référencé par la page répond 200.
#  Plusieurs essais espacés (le temps que Nginx voie le nouveau lien).
#
#  Code de sortie : 0 si tout est bon, 1 sinon (détail sur stderr).
#  Variables (tests) : NANEI_ESSAIS=6  NANEI_PAUSE=5 (secondes)

set -Eeuo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage : $0 <URL de l'admin> [<sha attendu>]" >&2
  exit 2
fi
URL="${1%/}"
SHA_ATTENDU="${2:-}"
ESSAIS="${NANEI_ESSAIS:-6}"
PAUSE="${NANEI_PAUSE:-5}"
ROUTE_PROFONDE="/nanei/admin/login"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# GET sans cache ; écrit le corps dans $TMP/corps, renvoie le code HTTP.
obtenir() {
  curl -sS -o "$TMP/corps" -w '%{http_code}' --max-time 15 \
    -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' \
    "$URL$1$( [[ "$1" == *\?* ]] && echo '&' || echo '?' )nocache=$(date +%s)-$RANDOM" || true  # en cas d'échec réseau, curl écrit « 000 »
}

verifier_une_fois() {
  local code version script

  if [ -n "$SHA_ATTENDU" ]; then
    code="$(obtenir /version.json)"
    [ "$code" = "200" ] || { echo "  /version.json : HTTP $code" >&2; return 1; }
    version="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP/corps" | head -1)"
    [ "$version" = "$SHA_ATTENDU" ] || { echo "  /version.json annonce « ${version:-illisible} », attendu « $SHA_ATTENDU »" >&2; return 1; }
    echo "  /version.json : $version ✓" >&2
  fi

  code="$(obtenir /)"
  [ "$code" = "200" ] || { echo "  / : HTTP $code" >&2; return 1; }
  grep -q 'id="root"' "$TMP/corps" || { echo "  / : la page ne contient pas l'application (id=\"root\" absent)" >&2; return 1; }

  code="$(obtenir "$ROUTE_PROFONDE")"
  [ "$code" = "200" ] || { echo "  $ROUTE_PROFONDE : HTTP $code (routes de la SPA non servies par index.html ?)" >&2; return 1; }
  grep -q 'id="root"' "$TMP/corps" || { echo "  $ROUTE_PROFONDE : la page ne contient pas l'application" >&2; return 1; }
  echo "  / et $ROUTE_PROFONDE : 200 ✓" >&2

  script="$(grep -o '<script[^>]*src="/assets/[^"]*\.js"' "$TMP/corps" | sed 's/.*src="\([^"]*\)".*/\1/' | head -1)"
  [ -n "$script" ] || { echo "  aucun script /assets/*.js référencé par la page" >&2; return 1; }
  code="$(obtenir "$script")"
  [ "$code" = "200" ] || { echo "  $script : HTTP $code" >&2; return 1; }
  echo "  $script : 200 ✓" >&2
}

for essai in $(seq 1 "$ESSAIS"); do
  echo "Vérification de $URL (essai $essai/$ESSAIS)" >&2
  if verifier_une_fois; then
    echo "En ligne : ${SHA_ATTENDU:-version non vérifiée} servie par $URL" >&2
    exit 0
  fi
  [ "$essai" -lt "$ESSAIS" ] && sleep "$PAUSE"
done
echo "ÉCHEC : $URL ne sert pas la version attendue après $ESSAIS essais" >&2
exit 1
