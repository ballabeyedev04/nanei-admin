#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Nanei admin — contrôle du livrable construit (dossier dist/)
# ═══════════════════════════════════════════════════════════════════════════
#
#  Usage : deploy/controler-dist.sh <dist> <sha> <VITE_API_URL> <API_VERSION_MIN>
#
#  Écrit un tableau Markdown (résumé GitHub) sur stdout, le détail des
#  problèmes sur stderr, et sort en code 1 au premier contrôle en échec
#  (après avoir affiché tous les résultats).
#
#  Contrôles :
#   - index.html et version.json présents ; version.json = { version: <sha>, date, apiMin } ;
#   - le sha et l'URL de l'API sont bien embarqués dans le JavaScript ;
#   - aucun fichier ou code de test (vitest, testing-library, jsdom, *.test.*),
#     aucune carte de sources (*.map : elle publierait le code source) ;
#   - aucune adresse locale (localhost, 127.0.0.1, 0.0.0.0) ni clé/jeton ;
#   - toutes les ressources locales référencées par index.html existent ;
#   - taille totale raisonnable (NANEI_TAILLE_MAX_KO, 8 Mo par défaut).

set -Eeuo pipefail
export LC_ALL=C

[ "$#" -eq 4 ] || { echo "usage : $0 <dist> <sha> <VITE_API_URL> <API_VERSION_MIN>" >&2; exit 2; }
DIST="${1%/}"
SHA="$2"
URL_API="$3"
API_MIN="$4"
TAILLE_MAX_KO="${NANEI_TAILLE_MAX_KO:-8192}"

ECHECS=0
ligne() { echo "| $1 | $2 | $3 |"; }
ok() { ligne "$1" "$2" "✅"; }
ko() { ligne "$1" "$2" "❌"; echo "ÉCHEC — $1 : $2" >&2; ECHECS=$((ECHECS + 1)); }

echo "| Contrôle du livrable | Résultat | |"
echo "|---|---|:---:|"

[ -d "$DIST" ] || { ko "Dossier" "$DIST absent"; exit 1; }

# ── Fichiers attendus ──────────────────────────────────────────────────────
if [ -f "$DIST/index.html" ]; then ok "index.html" "présent"; else ko "index.html" "absent"; fi

if [ -f "$DIST/version.json" ]; then
  LU="$(node -e '
    const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const date = typeof j.date === "string" && !Number.isNaN(Date.parse(j.date));
    console.log([j.version, date ? "date-ok" : "date-ko", Number.isInteger(j.apiMin) ? j.apiMin : "apimin-ko"].join("|"));
  ' "$DIST/version.json" 2> /dev/null || echo "illisible||")"
  IFS='|' read -r V_VERSION V_DATE V_APIMIN <<< "$LU"
  if [ "$V_VERSION" = "$SHA" ] && [ "$V_DATE" = "date-ok" ] && [ "$V_APIMIN" = "$API_MIN" ]; then
    ok "version.json" "version \`${SHA:0:7}\`, apiMin $API_MIN"
  else
    ko "version.json" "contenu inattendu (version=${V_VERSION:-?}, date=${V_DATE:-?}, apiMin=${V_APIMIN:-?})"
  fi
else
  ko "version.json" "absent"
fi

# ── Contenu du JavaScript ──────────────────────────────────────────────────
JS_LISTE="$(find "$DIST" -type f -name '*.js' | sort)"
if [ -z "$JS_LISTE" ]; then
  ko "JavaScript" "aucun fichier .js"
else
  # shellcheck disable=SC2086 # liste de chemins sans espaces (noms hachés de Vite)
  if grep -qF "$SHA" $JS_LISTE; then ok "Version embarquée" "sha \`${SHA:0:7}\` présent dans le bundle"; else ko "Version embarquée" "sha absent du bundle (VITE_APP_VERSION non transmise ?)"; fi
  # shellcheck disable=SC2086
  if grep -qF "$URL_API" $JS_LISTE; then ok "Adresse de l'API" "\`$URL_API\` embarquée"; else ko "Adresse de l'API" "\`$URL_API\` absente du bundle (VITE_API_URL non transmise ?)"; fi
fi

# ── Rien du harnais de test ────────────────────────────────────────────────
TESTS="$(find "$DIST" -type f \( -name '*.test.*' -o -name '*.spec.*' -o -path '*/__tests__/*' -o -name 'vitest*' -o -name 'setupTests*' \) | head -5)"
TRACES="$(grep -rlE 'vitest|@testing-library|jsdom|http://api\.test' "$DIST" 2> /dev/null | head -5 || true)"
if [ -z "$TESTS$TRACES" ]; then
  ok "Code de test" "aucun (fichier ou trace vitest / testing-library / jsdom)"
else
  ko "Code de test" "trouvé : $(echo "$TESTS $TRACES" | tr '\n' ' ')"
fi

CARTES="$(find "$DIST" -type f -name '*.map' | head -5)"
if [ -z "$CARTES" ]; then ok "Cartes de sources" "aucune (*.map)"; else ko "Cartes de sources" "présentes : $(echo "$CARTES" | tr '\n' ' ')"; fi

# ── Adresses locales et secrets ────────────────────────────────────────────
# Les bibliothèques (react-router, axios) contiennent la base factice
# "http://localhost" seule, sans port ni chemin, pour analyser des URL
# relatives : ce n'est pas une adresse appelée. Est refusée toute adresse
# locale avec un port ou un chemin (API ou serveur de développement).
MOTIF_LOCAL='https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+|/[A-Za-z0-9_./-]+)|(localhost|127\.0\.0\.1|0\.0\.0\.0):[0-9]+'
LOCAL="$(grep -rnoE "$MOTIF_LOCAL" "$DIST" 2> /dev/null | head -5 || true)"
if [ -z "$LOCAL" ]; then ok "Adresses locales" "aucune (localhost ou 127.0.0.1 avec port ou chemin)"; else ko "Adresses locales" "trouvées : $(echo "$LOCAL" | cut -c1-200 | tr '\n' ' ')"; fi

MOTIFS_SECRETS='-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk_(live|test)_[0-9A-Za-z]{10,}|gh[pousr]_[0-9A-Za-z]{30,}|xox[abprs]-[0-9A-Za-z-]{10,}|AIza[0-9A-Za-z_-]{35}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}'
SECRETS="$(grep -rlE -- "$MOTIFS_SECRETS" "$DIST" 2> /dev/null | head -5 || true)"
if [ -z "$SECRETS" ]; then ok "Clés et jetons" "aucun motif de clé privée, clé AWS/Stripe/GitHub/Google ou JWT"; else ko "Clés et jetons" "motif suspect dans : $(echo "$SECRETS" | tr '\n' ' ')"; fi

# ── Ressources référencées par index.html ──────────────────────────────────
if [ -f "$DIST/index.html" ]; then
  MANQUANTES=""
  NB_REF=0
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    NB_REF=$((NB_REF + 1))
    chemin="${ref%%[?#]*}"
    [ -f "$DIST$chemin" ] || MANQUANTES="$MANQUANTES $ref"
  done < <(grep -oE '(src|href)="/[^/"][^"]*"' "$DIST/index.html" | sed -E 's/^(src|href)="([^"]*)"$/\2/' | sort -u)
  if [ "$NB_REF" -eq 0 ]; then
    ko "Ressources d'index.html" "aucune ressource locale référencée"
  elif [ -z "$MANQUANTES" ]; then
    ok "Ressources d'index.html" "$NB_REF ressource(s) locale(s), toutes présentes"
  else
    ko "Ressources d'index.html" "manquantes :$MANQUANTES"
  fi
fi

# ── Taille ─────────────────────────────────────────────────────────────────
TAILLE_KO="$(du -sk "$DIST" | cut -f1)"
NB_FICHIERS="$(find "$DIST" -type f | wc -l | tr -d ' ')"
if [ "$TAILLE_KO" -le "$TAILLE_MAX_KO" ]; then
  ok "Taille" "$TAILLE_KO Ko, $NB_FICHIERS fichiers (max $TAILLE_MAX_KO Ko)"
else
  ko "Taille" "$TAILLE_KO Ko, au-delà de $TAILLE_MAX_KO Ko — fichier inattendu dans public/ ?"
fi

echo ""
if [ "$ECHECS" -gt 0 ]; then
  echo "$ECHECS contrôle(s) du livrable en échec." >&2
  exit 1
fi
