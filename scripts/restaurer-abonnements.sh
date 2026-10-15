#!/usr/bin/env bash
# Restaure la base des abonnements depuis une sauvegarde de
# `sauvegarder-abonnements.sh`.
#
# À exécuter SUR LE PI, depuis la copie clonée du dépôt. Arrête le backend le
# temps de remplacer le fichier : quelques secondes de coupure de l'API.
#
# Usage : bash scripts/restaurer-abonnements.sh sauvegardes/abonnements-<date>.sqlite

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

sauvegarde="${1:?Usage : bash scripts/restaurer-abonnements.sh <fichier .sqlite>}"
if [ ! -s "$sauvegarde" ]; then
  echo "Sauvegarde introuvable ou vide : $sauvegarde" >&2
  exit 1
fi

compose_args=()
for f in frontend/.env backend/.env; do
  [ -f "$f" ] && compose_args+=(--env-file "$f")
done
compose() { docker compose "${compose_args[@]}" "$@"; }

read -r -p "Remplacer la base des abonnements par ${sauvegarde} ? [o/N] " reponse
[ "$reponse" = "o" ] || { echo "Abandon, rien n'a changé."; exit 0; }

echo "→ Arrêt du backend..."
compose stop backend

# `docker cp` fonctionne sur un conteneur arrêté et écrit dans le volume monté.
echo "→ Copie de la sauvegarde dans le volume backend-data..."
compose cp "$sauvegarde" backend:/app/data/abonnements.sqlite

# `up` relance aussi `backend-data-init`, qui rend le volume à l'utilisateur
# `node` : le fichier copié appartient à root et serait illisible sinon.
echo "→ Redémarrage..."
compose up -d --wait --wait-timeout 120 backend

echo "✓ Abonnements restaurés depuis ${sauvegarde}."
