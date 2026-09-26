#!/usr/bin/env bash
# Déploiement manuel du site web (backend + frontend) sur Caesura.
#
# À exécuter DIRECTEMENT SUR LE PI (Caesura), depuis une copie clonée du
# dépôt WeatherQC — via SSH/Tailscale, pas depuis la machine Windows.
# C'est le repli quand `deploy-web.yml` reste bloqué en "Queued" parce que
# le runner self-hosted du Pi est hors ligne : ce script refait exactement
# ce que fait ce workflow, sans dépendre de GitHub Actions.
#
# Prérequis, déjà en place sur le Pi si le CI a déjà tourné une fois :
#   - dépôt cloné avec `frontend/.env` déposé à la main (valeurs de prod,
#     ce fichier n'est pas versionné et n'est jamais régénéré ici)
#   - docker + docker compose installés
#
# Usage : bash deploy-web.sh

set -euo pipefail

# Se place à la racine du dépôt quel que soit l'endroit d'où le script est
# appelé, pour éviter un `docker compose` lancé au mauvais endroit.
cd "$(git rev-parse --show-toplevel)"

if [ ! -f frontend/.env ]; then
  echo "frontend/.env introuvable — c'est le fichier de prod déposé à la main sur le Pi, pas régénéré ici." >&2
  echo "Rien n'a été démarré." >&2
  exit 1
fi

echo "→ Récupération de main..."
git fetch origin main
git checkout main
git pull origin main

echo "→ Build & (re)démarrage des conteneurs (peut prendre un moment)..."
# `--wait` fait échouer le script si le healthcheck du backend ne passe pas
# ou si le frontend ne démarre pas — même garde que dans deploy-web.yml,
# pour ne pas laisser un déploiement cassé tourner en silence.
docker compose --env-file frontend/.env --env-file backend/.env up -d --build --wait --wait-timeout 120

echo "✓ Déploiement terminé."
docker compose ps
