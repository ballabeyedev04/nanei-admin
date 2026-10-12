#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Nanei admin — le back en ligne est-il compatible avec cette version ?
# ═══════════════════════════════════════════════════════════════════════════
#
#  Usage : deploy/verifier-back.sh <VITE_API_URL> <API_VERSION_MIN>
#    ex.   deploy/verifier-back.sh https://api.app-nanei.com/nanei 2
#
#  Appelle <origine de VITE_API_URL>/health (même domaine, SANS /nanei).
#  Contrat du back : { "status": "OK", "db": "ok", "version": "<sha>", "api": <entier> }
#
#  Refuse (code 1) si le back est injoignable, si sa santé n'est pas OK, si
#  `api` est absent ou inférieur à API_VERSION_MIN : il faut alors DÉPLOYER
#  D'ABORD LE BACK (ordre de déploiement : back puis admin).
#
#  Sortie (stdout) : lignes CLE=valeur — API_BACK, SHA_BACK, URL_SANTE.
#  Variables (tests) : NANEI_AUTORISER_HTTP=1 accepte une URL http://.

set -Eeuo pipefail

refus() {
  echo "REFUS : $*" >&2
  [ "${GITHUB_ACTIONS:-}" = "true" ] && echo "::error title=Back incompatible::$*"
  exit 1
}

[ "$#" -eq 2 ] || { echo "usage : $0 <VITE_API_URL> <API_VERSION_MIN>" >&2; exit 2; }
URL_API="$1"
API_MIN="$2"
[[ "$API_MIN" =~ ^[0-9]+$ ]] || refus "API_VERSION_MIN invalide : « $API_MIN »"

# Origine = schéma + hôte (+ port) : https://api.app-nanei.com/nanei → https://api.app-nanei.com
if [[ "$URL_API" =~ ^(https://[^/?#]+) ]] || { [ "${NANEI_AUTORISER_HTTP:-}" = "1" ] && [[ "$URL_API" =~ ^(http://[^/?#]+) ]]; }; then
  ORIGINE="${BASH_REMATCH[1]}"
else
  refus "VITE_API_URL doit être une URL https:// (reçu : « $URL_API »)"
fi
URL_SANTE="$ORIGINE/health"
echo "URL_SANTE=$URL_SANTE"

CORPS="$(mktemp)"
trap 'rm -f "$CORPS"' EXIT
set +e
CODE_HTTP="$(curl -sS -o "$CORPS" -w '%{http_code}' --max-time 15 --retry 3 --retry-delay 5 --retry-all-errors \
  -H 'Cache-Control: no-cache' "$URL_SANTE?t=$(date +%s)")"
CODE_CURL=$?
set -e
[ "$CODE_CURL" -eq 0 ] || refus "back injoignable ($URL_SANTE, erreur curl $CODE_CURL) : déployer d'abord le back, ou vérifier qu'il tourne"

# Lecture du JSON avec Node (présent sur les machines GitHub et en local).
LU="$(node -e '
  const fs = require("fs");
  let j;
  try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch { j = null; }
  if (!j || typeof j !== "object") { console.log("JSON_INVALIDE"); process.exit(0); }
  const api = Number.isInteger(j.api) ? j.api : (typeof j.api === "string" && /^\d+$/.test(j.api) ? Number(j.api) : "");
  const propre = (v) => String(v ?? "").replace(/[^A-Za-z0-9._-]/g, "");
  console.log([propre(j.status), propre(j.db), propre(j.version), api].join("|"));
' "$CORPS")"
[ "$LU" != "JSON_INVALIDE" ] || refus "réponse de $URL_SANTE illisible (HTTP $CODE_HTTP, pas du JSON) : le back déployé est trop ancien ou en panne — déployer d'abord le back"
# Séparateur « | » : un champ vide reste vide (avec des espaces, les champs
# suivants glisseraient d'un cran).
IFS='|' read -r STATUT DB SHA_BACK API_BACK <<< "$LU"

echo "SHA_BACK=${SHA_BACK:-}"
echo "API_BACK=${API_BACK:-}"

[ "$CODE_HTTP" = "200" ] || refus "santé du back KO : HTTP $CODE_HTTP sur $URL_SANTE (status=${STATUT:-?}, db=${DB:-?}) — rétablir le back avant de déployer l'admin"
[ "$STATUT" = "OK" ] || refus "santé du back KO : status=« ${STATUT:-absent} » (attendu OK) sur $URL_SANTE"
[ "$DB" = "ok" ] || refus "santé du back KO : db=« ${DB:-absent} » (attendu ok) — base de données indisponible"
[ -n "$API_BACK" ] || refus "le back ne publie pas sa version de contrat (champ « api » absent de $URL_SANTE) : il est antérieur à cette chaîne — DÉPLOYER D'ABORD LE BACK"
[ "$API_BACK" -ge "$API_MIN" ] || refus "le back expose l'API v$API_BACK, cette version de l'admin exige au moins v$API_MIN — DÉPLOYER D'ABORD LE BACK (sha du back en ligne : ${SHA_BACK:-inconnu})"

echo "Back compatible : API v$API_BACK ≥ v$API_MIN requise (sha ${SHA_BACK:-inconnu})" >&2
