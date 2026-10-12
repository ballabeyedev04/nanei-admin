#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Nanei admin — écrit dist/version.json (relu après la mise en ligne)
# ═══════════════════════════════════════════════════════════════════════════
#
#  Usage : deploy/ecrire-version.sh <dist> <sha> <API_VERSION_MIN>
#  Produit : { "version": "<sha>", "date": "<ISO 8601 UTC>", "apiMin": <entier> }
#
#  La chaîne compare ensuite https://admin.app-nanei.com/version.json au sha
#  déployé : c'est la preuve que la nouvelle version est réellement servie.

set -Eeuo pipefail

[ "$#" -eq 3 ] || { echo "usage : $0 <dist> <sha> <API_VERSION_MIN>" >&2; exit 2; }
DIST="${1%/}"
SHA="$2"
API_MIN="$3"

[ -f "$DIST/index.html" ] || { echo "ERREUR : $DIST/index.html absent (construire d'abord)" >&2; exit 1; }
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "ERREUR : sha invalide « $SHA »" >&2; exit 1; }
[[ "$API_MIN" =~ ^[0-9]+$ ]] || { echo "ERREUR : API_VERSION_MIN invalide « $API_MIN »" >&2; exit 1; }

DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{\n  "version": "%s",\n  "date": "%s",\n  "apiMin": %s\n}\n' "$SHA" "$DATE" "$API_MIN" > "$DIST/version.json"
cat "$DIST/version.json"
