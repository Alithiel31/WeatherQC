#!/usr/bin/env bash
# Déclenche un workflow GitHub Actions via workflow_dispatch et suit son
# exécution en direct, sans deviner de délai fixe.
#
# Le point fragile d'un `sleep N` est qu'il devine combien de temps GitHub
# Actions met à faire apparaître le run dans la liste. Ici, on note l'heure
# juste avant le déclenchement, puis on interroge `gh run list` en boucle
# jusqu'à trouver un run créé après cet horodatage — borné à 60s, pour ne
# jamais rester bloqué si quelque chose ne se passe pas comme prévu.
#
# Usage : scripts/gh-deploy.sh <workflow.yml> [ref]

set -euo pipefail

workflow="${1:?Usage: gh-deploy.sh <workflow.yml> [ref]}"
ref="${2:-main}"

avant=$(date -u +%Y-%m-%dT%H:%M:%SZ)

gh workflow run "$workflow" --ref "$ref"
echo "Déclenché sur $ref, recherche du run..."

run_id=""
for _ in $(seq 1 30); do
  run_id=$(gh run list --workflow="$workflow" --branch "$ref" --limit 5 \
    --json databaseId,createdAt \
    --jq "[.[] | select(.createdAt > \"$avant\")] | sort_by(.createdAt) | .[0].databaseId // empty")
  [ -n "$run_id" ] && break
  sleep 2
done

if [ -z "$run_id" ]; then
  echo "Run introuvable après 60s (vérifier manuellement dans l'onglet Actions)." >&2
  exit 1
fi

echo "Run $run_id trouvé, suivi en direct :"
gh run watch "$run_id" --exit-status
