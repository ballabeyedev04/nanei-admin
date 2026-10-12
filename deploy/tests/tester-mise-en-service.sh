#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Tests de deploy/mettre-en-service.sh, dans des dossiers temporaires qui
#  simulent /var/www (aucun accès au serveur).
# ═══════════════════════════════════════════════════════════════════════════
#
#  Usage : bash deploy/tests/tester-mise-en-service.sh
#  Lancé par la chaîne (job « 2b · Tests ») sous Linux ; fonctionne aussi
#  sous Git Bash (Windows) : liens symboliques natifs, et `flock` remplacé
#  par un substitut sans effet (les tests de verrou sont alors sautés).

set -Eeuo pipefail
export LC_ALL=C

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$ICI/../mettre-en-service.sh"
RACINE="$(mktemp -d)"
trap 'rm -rf "$RACINE"' EXIT

LINUX=false
[ "$(uname -s)" = "Linux" ] && LINUX=true
if ! $LINUX; then
  # Git Bash : vrais liens symboliques Windows (sinon `ln -s` copie).
  export MSYS=winsymlinks:nativestrict
fi
VRAI_FLOCK=true
if ! command -v flock > /dev/null 2>&1; then
  VRAI_FLOCK=false
  mkdir -p "$RACINE/bin"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$RACINE/bin/flock"
  chmod +x "$RACINE/bin/flock"
  export PATH="$RACINE/bin:$PATH"
fi

REUSSIS=0
ECHOUES=0
reussi() { REUSSIS=$((REUSSIS + 1)); echo "  ✓ $1"; }
echoue() { ECHOUES=$((ECHOUES + 1)); echo "  ✗ $1" >&2; }
attendre_egal() { if [ "$2" = "$3" ]; then reussi "$1"; else echoue "$1 (attendu « $3 », obtenu « $2 »)"; fi; }
attendre_vrai() { local d="$1"; shift; if "$@"; then reussi "$d"; else echoue "$d"; fi; }

# Environnement neuf : $WWW simule /var/www.
nouveau_www() {
  WWW="$RACINE/www-$1"
  mkdir -p "$WWW"
  export NANEI_WWW="$WWW" NANEI_CONSERVER=5 NANEI_ATTENTE_VERROU=5
  LIEN="$WWW/nanei-admin"
  VERSIONS="$WWW/nanei-admin-releases"
}

# Fabrique une archive comme la chaîne : fabriquer <n> [sans-version|sha-faux|lien]
# → ARCHIVE, SOMME, NOM, SHA
fabriquer() {
  local n="$1" variante="${2:-}" d
  SHA="$(printf 'c0ffee%02d' "$n")$(printf '%032d' "$n")"
  NOM="$(printf '202610%02d-120000' "$n")-${SHA:0:7}"
  d="$RACINE/dist-$n-$variante"
  rm -rf "$d"; mkdir -p "$d/assets"
  echo "<div id=\"root\">version $n</div>" > "$d/index.html"
  echo "console.log($n)" > "$d/assets/app-$n.js"
  case "$variante" in
    sans-version) ;;
    sha-faux) printf '{ "version": "deadbeef%s", "date": "2026-10-12T00:00:00Z", "apiMin": 2 }\n' "$n" > "$d/version.json" ;;
    *) printf '{\n  "version": "%s",\n  "date": "2026-10-12T00:00:00Z",\n  "apiMin": 2\n}\n' "$SHA" > "$d/version.json" ;;
  esac
  [ "$variante" = "lien" ] && ln -s index.html "$d/raccourci.html"
  ARCHIVE="$RACINE/archive-$n-$variante.tar.gz"
  tar -czf "$ARCHIVE" -C "$d" .
  SOMME="$(sha256sum "$ARCHIVE" | cut -d' ' -f1)"
}

servie() { cat "$LIEN/index.html" 2> /dev/null || echo "(rien)"; }
cible_lien() { readlink "$LIEN" 2> /dev/null || echo "(pas un lien)"; }
valeur() { sed -n "s/^$1=//p" "$RACINE/sortie" | tail -1; }
lancer() { bash "$SCRIPT" "$@" > "$RACINE/sortie" 2> "$RACINE/journal"; }

# ─────────────────────────────────────────────────────────────────────────
echo "1. Première installation (aucun /var/www/nanei-admin)"
nouveau_www premiere
fabriquer 1
attendre_vrai "installer réussit" lancer installer "$ARCHIVE" "$SOMME" "$NOM"
attendre_vrai "nanei-admin est un lien symbolique" test -L "$LIEN"
attendre_egal "lien relatif vers la version" "$(cible_lien)" "nanei-admin-releases/$NOM"
attendre_egal "page servie" "$(servie)" '<div id="root">version 1</div>'
attendre_egal "VERSION_ACTUELLE" "$(valeur VERSION_ACTUELLE)" "$NOM"
attendre_egal "VERSION_PRECEDENTE vide" "$(valeur VERSION_PRECEDENTE)" ""
attendre_egal "SHA_ACTUEL lu dans version.json" "$(valeur SHA_ACTUEL)" "$SHA"
attendre_egal "aucun reste d'extraction" "$(find "$VERSIONS" -maxdepth 1 -name '.extraction-*' | wc -l | tr -d ' ')" "0"

# ─────────────────────────────────────────────────────────────────────────
echo "2. Migration : /var/www/nanei-admin est encore un vrai dossier"
nouveau_www migration
mkdir -p "$LIEN/assets"
echo '<div id="root">ancien site scp</div>' > "$LIEN/index.html"
echo 'ancien' > "$LIEN/assets/ancien.js"
fabriquer 1
attendre_vrai "installer réussit" lancer installer "$ARCHIVE" "$SOMME" "$NOM"
attendre_vrai "nanei-admin est devenu un lien" test -L "$LIEN"
attendre_egal "nouvelle version servie" "$(servie)" '<div id="root">version 1</div>'
INITIALE="$(valeur VERSION_PRECEDENTE)"
attendre_vrai "ancienne version conservée comme « 00000000-000000-initiale »" test -f "$VERSIONS/$INITIALE/assets/ancien.js"
attendre_egal "nom de la version initiale (la plus ancienne)" "$INITIALE" "00000000-000000-initiale"
attendre_vrai "retour arrière vers la version initiale" lancer revenir precedente
attendre_egal "ancien site de nouveau servi" "$(servie)" '<div id="root">ancien site scp</div>'
attendre_egal "SHA_ACTUEL vide (pas de version.json)" "$(valeur SHA_ACTUEL)" ""
attendre_vrai "retour vers la version 1 par son nom" lancer revenir "$NOM"
attendre_egal "version 1 servie" "$(servie)" '<div id="root">version 1</div>'

# ─────────────────────────────────────────────────────────────────────────
echo "3. Refus sans rien toucher à la version servie"
nouveau_www refus
fabriquer 1
lancer installer "$ARCHIVE" "$SOMME" "$NOM"
V1="$NOM"
fabriquer 2
attendre_vrai "somme SHA-256 fausse → refus" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$(printf '0%.0s' {1..64})' '$NOM' 2> /dev/null"
attendre_egal "version 1 toujours servie" "$(servie)" '<div id="root">version 1</div>'
attendre_vrai "aucun dossier créé" test ! -e "$VERSIONS/$NOM"
fabriquer 3 sans-version
attendre_vrai "archive sans version.json → refus" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$SOMME' '$NOM' 2> /dev/null"
attendre_vrai "extraction nettoyée" test -z "$(find "$VERSIONS" -maxdepth 1 -name '.extraction-*')"
fabriquer 4 sha-faux
attendre_vrai "version.json incohérent avec le nom → refus" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$SOMME' '$NOM' 2> /dev/null"
if $LINUX; then
  fabriquer 5 lien
  attendre_vrai "archive contenant un lien symbolique → refus" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$SOMME' '$NOM' 2> /dev/null"
fi
fabriquer 1
attendre_vrai "version déjà présente → refus" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$SOMME' '$V1' 2> /dev/null"
attendre_vrai "nom de version invalide → refus" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$SOMME' '../../etc' 2> /dev/null"
attendre_vrai "commande inconnue → refus" bash -c "! bash '$SCRIPT' supprimer-tout 2> /dev/null"
attendre_egal "version 1 toujours servie après tous les refus" "$(servie)" '<div id="root">version 1</div>'
attendre_egal "un seul dossier de version" "$(find "$VERSIONS" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" "1"

# ─────────────────────────────────────────────────────────────────────────
echo "4. Rétention (5 versions) et retours arrière"
nouveau_www retention
declare -A NOMS SHAS
for n in 1 2 3 4 5 6 7; do
  fabriquer "$n"
  lancer installer "$ARCHIVE" "$SOMME" "$NOM"
  NOMS[$n]="$NOM"
  SHAS[$n]="$SHA"
done
attendre_egal "5 versions conservées" "$(find "$VERSIONS" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" "5"
attendre_vrai "les 2 plus anciennes supprimées" test ! -e "$VERSIONS/${NOMS[1]}" -a ! -e "$VERSIONS/${NOMS[2]}"
attendre_vrai "la plus ancienne gardée est la 3" test -d "$VERSIONS/${NOMS[3]}"
attendre_egal "version 7 servie" "$(servie)" '<div id="root">version 7</div>'
attendre_vrai "revenir (précédente par défaut)" lancer revenir
attendre_egal "version 6 servie" "$(servie)" '<div id="root">version 6</div>'
attendre_egal "SHA_ACTUEL = sha 6" "$(valeur SHA_ACTUEL)" "${SHAS[6]}"
attendre_egal "VERSION_PRECEDENTE = 7" "$(valeur VERSION_PRECEDENTE)" "${NOMS[7]}"
attendre_vrai "revenir encore (précédente de la 6)" lancer revenir précédente
attendre_egal "version 5 servie" "$(servie)" '<div id="root">version 5</div>'
attendre_vrai "revenir vers une version supprimée → refus" bash -c "! bash '$SCRIPT' revenir '${NOMS[1]}' 2> /dev/null"
attendre_vrai "revenir vers la version déjà servie → refus" bash -c "! bash '$SCRIPT' revenir '${NOMS[5]}' 2> /dev/null"
attendre_vrai "revenir vers la 7 par son nom" lancer revenir "${NOMS[7]}"
attendre_egal "version 7 servie" "$(servie)" '<div id="root">version 7</div>'
# Nouvelle installation alors que la 3 est la plus ancienne : la version
# précédente (7) et la nouvelle (8) ne sont jamais supprimées.
fabriquer 8
lancer installer "$ARCHIVE" "$SOMME" "$NOM"
attendre_egal "toujours 5 versions" "$(find "$VERSIONS" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" "5"
attendre_vrai "la 7 (précédente) est gardée" test -d "$VERSIONS/${NOMS[7]}"
# Retour arrière automatique de la chaîne : retour à la 7 et abandon de la 8.
NOMS[8]="$NOM"
attendre_vrai "revenir … --abandonner" lancer revenir "${NOMS[7]}" --abandonner "${NOMS[8]}"
attendre_egal "version 7 servie" "$(servie)" '<div id="root">version 7</div>'
attendre_vrai "version 8 ratée supprimée" test ! -e "$VERSIONS/${NOMS[8]}"
attendre_vrai "lister fonctionne" lancer lister
attendre_vrai "lister marque la version servie" grep -q "^\* ${NOMS[7]}" "$RACINE/journal"
attendre_vrai "actuelle fonctionne" lancer actuelle
attendre_egal "actuelle = 7" "$(valeur VERSION_ACTUELLE)" "${NOMS[7]}"

# ─────────────────────────────────────────────────────────────────────────
echo "5. Cas limites"
nouveau_www limites
attendre_vrai "revenir sans aucune version → refus" bash -c "! bash '$SCRIPT' revenir 2> /dev/null"
mkdir -p "$LIEN"; echo x > "$LIEN/index.html"
attendre_vrai "revenir quand nanei-admin est un vrai dossier → refus" bash -c "! bash '$SCRIPT' revenir 2> /dev/null"
nouveau_www lien-etranger
mkdir -p "$WWW/ailleurs"; echo x > "$WWW/ailleurs/index.html"
ln -s ailleurs "$LIEN"
fabriquer 1
attendre_vrai "lien vers un dossier inconnu → refus (correction manuelle)" bash -c "! bash '$SCRIPT' installer '$ARCHIVE' '$SOMME' '$NOM' 2> /dev/null"
attendre_egal "lien étranger intact" "$(cible_lien)" "ailleurs"

# ─────────────────────────────────────────────────────────────────────────
if $LINUX && $VRAI_FLOCK; then
  echo "6. Verrou et atomicité (Linux)"
  nouveau_www verrou
  fabriquer 1; lancer installer "$ARCHIVE" "$SOMME" "$NOM"; A="$NOM"
  fabriquer 2; lancer installer "$ARCHIVE" "$SOMME" "$NOM"; B="$NOM"
  mkdir -p "$VERSIONS"
  ( exec 9> "$VERSIONS/.verrou"; flock 9; sleep 4 ) &
  PORTEUR=$!
  sleep 1
  export NANEI_ATTENTE_VERROU=1
  attendre_vrai "verrou tenu ailleurs → refus après l'attente" bash -c "! bash '$SCRIPT' revenir 2> /dev/null"
  attendre_egal "rien n'a basculé" "$(servie)" '<div id="root">version 2</div>'
  wait "$PORTEUR"
  export NANEI_ATTENTE_VERROU=5
  attendre_vrai "verrou libéré → retour arrière possible" lancer revenir
  # Bascules en boucle pendant des lectures continues : aucune lecture ne
  # doit échouer (le lien n'est jamais absent).
  (
    for _ in $(seq 1 40); do
      bash "$SCRIPT" revenir "$B" > /dev/null 2>&1
      bash "$SCRIPT" revenir "$A" > /dev/null 2>&1
    done
  ) &
  BASCULES=$!
  RATES=0
  while kill -0 "$BASCULES" 2> /dev/null; do
    cat "$LIEN/index.html" > /dev/null 2>&1 || RATES=$((RATES + 1))
  done
  wait "$BASCULES"
  attendre_egal "aucune lecture ratée pendant 80 bascules" "$RATES" "0"
  chmod a-w "$WWW"
  if [ ! -w "$WWW" ]; then
    attendre_vrai "/var/www non modifiable → refus clair" bash -c "bash '$SCRIPT' revenir 2>&1 | grep -q \"n'est pas modifiable\""
  fi
  chmod u+w "$WWW"
else
  echo "6. Verrou et atomicité : sautés (pas de flock réel ou pas sous Linux)"
fi

echo ""
echo "Résultat : $REUSSIS réussi(s), $ECHOUES échoué(s)"
[ "$ECHOUES" -eq 0 ]
