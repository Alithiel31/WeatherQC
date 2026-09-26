#!/usr/bin/env bash
# Build manuel de l'AAB Android (TWA) en local, sans passer par GitHub Actions.
#
# À exécuter depuis la racine du dépôt WeatherQC, sur la machine qui détient
# `twa-qcweather/android.keystore` (ta machine de dev).
#
# Important : "deploy" ici veut dire "construire et signer l'AAB", pas
# "l'envoyer sur le Play Store" — contrairement à `build-twa.yml` +
# `deploy-twa.yml` en CI, ce script ne fait PAS l'upload automatiquement
# (pas de service account Play configuré en local). L'upload reste manuel,
# voir les instructions affichées à la fin.
#
# Bubblewrap demande parfois, avant de builder :
#   "Would you like to apply [twa-manifest.json] changes to the project
#   before building?"
# Répondre "Yes" ici écrase app/build.gradle avec une version générée à
# partir de twa-manifest.json, ce qui détruit la logique de versionCode
# personnalisée (versionCodeBase + QCW_COMMIT_COUNT, voir plus bas). C'est
# exactement ce qui est arrivé une fois en exécutant ce script à la main.
# `build-twa.yml` en CI évite ce piège en répondant automatiquement "n" à
# cette question via `expect` — ce script fait pareil ci-dessous, puis rend
# la main au terminal (mots de passe du keystore saisis normalement au
# clavier, rien d'automatisé à cette étape).
#
# Usage : bash deploy-android.sh

set -euo pipefail

cd "$(git rev-parse --show-toplevel)/twa-qcweather"

if [ ! -f android.keystore ]; then
  echo "twa-qcweather/android.keystore introuvable ici — rien à signer." >&2
  exit 1
fi

# Le versionCode doit être strictement supérieur au dernier publié sur le
# Play Store, sous peine de refus d'upload. Même base que app/build.gradle
# (versionCodeBase + nombre de commits), pour rester cohérent avec les
# versions déjà publiées par la CI.
base=$(sed -n 's/^def versionCodeBase = \([0-9]\+\).*/\1/p' app/build.gradle)
commit_count=$(git -C .. rev-list --count HEAD)
export QCW_COMMIT_COUNT="$commit_count"
echo "versionCode calculé : $((base + commit_count)) (base $base + $commit_count commits)"

# Installe Bubblewrap à la volée si absent, à la même version que la CI —
# éviter qu'une version plus récente change silencieusement le comportement
# du build entre CI et local.
if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "→ Bubblewrap absent, utilisation via npx (@bubblewrap/cli@1.25.0)..."
  BUBBLEWRAP="npx --yes @bubblewrap/cli@1.25.0"
else
  BUBBLEWRAP="bubblewrap"
fi

echo "→ Build de l'AAB (tu vas devoir saisir les mots de passe du keystore)..."

if command -v expect >/dev/null 2>&1; then
  tmp_expect="$(mktemp)"
  trap 'rm -f "$tmp_expect"' EXIT

  cat >"$tmp_expect" <<EOF
set timeout 120
spawn bash -c "$BUBBLEWRAP build --skipPwaValidation"
expect {
  "Would you like to apply" { send "n\r" }
  timeout { puts stderr "Bubblewrap n'a pas affiché le prompt attendu (timeout)." ; exit 1 }
  eof {}
}
interact
EOF

  expect "$tmp_expect"
else
  cat >&2 <<'EOF'
ATTENTION : la commande "expect" est introuvable sur cette machine.

Sans elle, ce script ne peut pas répondre automatiquement "non" à la
question de Bubblewrap :
  "Would you like to apply [...] changes to the project before building?"

Répondre "Yes" à cette question écrase app/build.gradle et casse le
versionCode personnalisé (versionCodeBase + QCW_COMMIT_COUNT).

Deux options :
  1. Installer "expect" (ex. via MSYS2 : pacman -S expect) puis relancer
     ce script.
  2. Lancer Bubblewrap toi-même et répondre IMPÉRATIVEMENT "No" (n) à
     cette question précise :

EOF
  echo "     $BUBBLEWRAP build --skipPwaValidation" >&2
  exit 1
fi

echo
echo "✓ AAB généré : twa-qcweather/app-release-bundle.aab"
echo
echo "Étapes manuelles restantes (Play Console) :"
echo "  1. Tester et publier → Tests fermés → Alpha → Créer une version"
echo "  2. Uploader app-release-bundle.aab"
echo "  3. Renseigner les notes de version, puis publier sur le canal fermé"
