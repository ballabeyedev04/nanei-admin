#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Tests de deploy/verifier-back.sh et deploy/verifier-en-ligne.sh contre un
#  serveur factice local (deploy/tests/serveur-factice.mjs). Aucun accès réseau.
# ═══════════════════════════════════════════════════════════════════════════
#
#  Usage : bash deploy/tests/tester-verifications.sh   (Node requis)

set -Eeuo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$ICI/.."
RACINE="$(mktemp -d)"
PIDS=()
nettoyer() { for p in "${PIDS[@]}"; do kill "$p" 2> /dev/null || true; done; rm -rf "$RACINE"; }
trap nettoyer EXIT

REUSSIS=0
ECHOUES=0
reussi() { REUSSIS=$((REUSSIS + 1)); echo "  ✓ $1"; }
echoue() { ECHOUES=$((ECHOUES + 1)); echo "  ✗ $1" >&2; }
accepte() {
  local d="$1"; shift
  if "$@" > "$RACINE/sortie" 2> "$RACINE/journal"; then reussi "$d"; else echoue "$d : $(tail -1 "$RACINE/journal")"; fi
}
refuse() {
  local d="$1" motif="$2"; shift 2
  if "$@" > "$RACINE/sortie" 2> "$RACINE/journal"; then echoue "$d (accepté à tort)"
  elif grep -q -- "$motif" "$RACINE/journal"; then reussi "$d"
  else echoue "$d (message inattendu : $(tail -1 "$RACINE/journal"))"; fi
}
sortie_contient() {
  if grep -qx -- "$2" "$RACINE/sortie"; then reussi "$1"; else echoue "$1 (sortie : $(tr '\n' ' ' < "$RACINE/sortie"))"; fi
}

PORT=18700
demarrer() { # demarrer <mode> [dossier] → URL
  PORT=$((PORT + 1))
  node "$ICI/serveur-factice.mjs" "$PORT" "$@" > "$RACINE/serveur-$PORT.log" 2>&1 &
  PIDS+=($!)
  local _
  for _ in $(seq 1 200); do
    if grep -q prêt "$RACINE/serveur-$PORT.log" 2> /dev/null; then break; fi
    sleep 0.1
  done
  grep -q prêt "$RACINE/serveur-$PORT.log" || { echo "serveur factice non démarré (port $PORT) : $(cat "$RACINE/serveur-$PORT.log")" >&2; exit 1; }
  URL="http://127.0.0.1:$PORT"
}

export NANEI_AUTORISER_HTTP=1
echo "1. verifier-back.sh (compatibilité du back)"
demarrer sante-ok
accepte "api 2, exigée 2 → accepté" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
sortie_contient "API_BACK=2 en sortie" "API_BACK=2"
sortie_contient "/health appelé sur l'origine, sans /nanei" "URL_SANTE=$URL/health"
demarrer sante-api3
accepte "api 3, exigée 2 → accepté" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
demarrer sante-api1
refuse "api 1, exigée 2 → refusé" "DÉPLOYER D'ABORD LE BACK" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
demarrer sante-sans-api
refuse "champ api absent → refusé" "champ « api » absent" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
demarrer sante-db-ko
refuse "base indisponible (503) → refusé" "HTTP 503" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
demarrer sante-statut-ko
refuse "status ≠ OK → refusé" "status=« DEGRADED »" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
demarrer sante-html
refuse "réponse non JSON → refusé" "illisible" bash "$DEPLOY/verifier-back.sh" "$URL/nanei" 2
refuse "back injoignable → refusé" "injoignable" bash "$DEPLOY/verifier-back.sh" "http://127.0.0.1:1/nanei" 2
NANEI_AUTORISER_HTTP=0 refuse "URL http:// refusée par défaut" "https://" bash "$DEPLOY/verifier-back.sh" "http://exemple.test/nanei" 2

echo "2. verifier-en-ligne.sh (version réellement servie)"
SHA="0123456789abcdef0123456789abcdef01234567"
DIST="$RACINE/dist"
mkdir -p "$DIST/assets"
echo '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-abc.js"></script></head><body><div id="root"></div></body></html>' > "$DIST/index.html"
echo 'console.log(1)' > "$DIST/assets/index-abc.js"
printf '{ "version": "%s", "date": "2026-10-12T00:00:00Z", "apiMin": 2 }\n' "$SHA" > "$DIST/version.json"
export NANEI_ESSAIS=2 NANEI_PAUSE=0
demarrer spa "$DIST"
accepte "bon sha + routes SPA → accepté" bash "$DEPLOY/verifier-en-ligne.sh" "$URL" "$SHA"
accepte "sans sha attendu (retour vers la version initiale) → accepté" bash "$DEPLOY/verifier-en-ligne.sh" "$URL"
refuse "autre sha servi → refusé" "attendu « fffffff »" bash "$DEPLOY/verifier-en-ligne.sh" "$URL" "fffffff"
demarrer spa-sans-repli "$DIST"
refuse "route profonde en 404 → refusé" "/nanei/admin/login : HTTP 404" bash "$DEPLOY/verifier-en-ligne.sh" "$URL" "$SHA"
rm "$DIST/assets/index-abc.js"
demarrer spa "$DIST"
refuse "script principal absent → refusé" "index-abc.js : HTTP 404" bash "$DEPLOY/verifier-en-ligne.sh" "$URL" "$SHA"
refuse "site injoignable → refusé" "HTTP 000" bash "$DEPLOY/verifier-en-ligne.sh" "http://127.0.0.1:1" "$SHA"

echo ""
echo "Résultat : $REUSSIS réussi(s), $ECHOUES échoué(s)"
[ "$ECHOUES" -eq 0 ]
