#!/usr/bin/env bash
# Sauvegarde de la base SQLite des abonnements aux alertes météo.
#
# À exécuter SUR LE PI (Caesura), depuis la copie clonée du dépôt — comme
# `deploy-web.sh`. La base vit dans le volume Docker `backend-data` : c'est la
# seule donnée de l'application qui ne se reconstruit pas. Le cache se
# reremplit tout seul ; un abonnement perdu, lui, ne revient que si chaque
# utilisateur pense à se réabonner.
#
# La copie est faite par SQLite lui-même (`VACUUM INTO`, via le module
# `node:sqlite` déjà présent dans l'image) : instantané cohérent même si le
# backend écrit au même moment, sans l'arrêter. Copier le fichier à chaud avec
# `cp` pourrait saisir une page à moitié écrite.
#
# Usage : bash scripts/sauvegarder-abonnements.sh [dossier] [nombre à garder]
#   dossier          défaut : ./sauvegardes (ignoré par git)
#   nombre à garder  défaut : 14 — les plus anciennes au-delà sont supprimées
#
# Pensé pour être appelé chaque nuit (cron ou timer systemd), et le dossier
# repris par la sauvegarde hors site du Pi — voir docs/guide-de-reprise.md.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

dossier="${1:-sauvegardes}"
a_garder="${2:-14}"

# Mêmes fichiers d'environnement que `deploy-web.sh` : le compose interpole
# des variables du frontend, absentes sinon (avertissements, voire refus).
compose_args=()
for f in frontend/.env backend/.env; do
  [ -f "$f" ] && compose_args+=(--env-file "$f")
done
compose() { docker compose "${compose_args[@]}" "$@"; }

if [ -z "$(compose ps --status running -q backend)" ]; then
  echo "Le conteneur backend ne tourne pas : rien à sauvegarder à chaud." >&2
  echo "Le démarrer (deploy-web.sh) ou copier le volume backend-data à froid." >&2
  exit 1
fi

horodatage="$(date -u +%Y%m%dT%H%M%SZ)"
dans_conteneur="/tmp/abonnements-${horodatage}.sqlite"
destination="${dossier}/abonnements-${horodatage}.sqlite"

mkdir -p "$dossier"

# Instantané puis vérification d'intégrité, dans le conteneur : `/tmp` y est
# le seul endroit inscriptible hors du volume (tmpfs, cf. docker-compose.yml).
compose exec -T backend node -e '
  const { DatabaseSync } = require("node:sqlite");
  const [source, cible] = process.argv.slice(1);
  new DatabaseSync(source, { readOnly: true }).exec(`VACUUM INTO '\''${cible}'\''`);
  const copie = new DatabaseSync(cible, { readOnly: true });
  const { integrity_check } = copie.prepare("PRAGMA integrity_check").get();
  const { n } = copie.prepare("SELECT COUNT(*) AS n FROM abonnements").get();
  if (integrity_check !== "ok") { console.error("Copie corrompue :", integrity_check); process.exit(1); }
  console.log(`${n} abonnement(s) dans la copie.`);
' "${DB_PATH_CONTENEUR:-/app/data/abonnements.sqlite}" "$dans_conteneur"

compose cp "backend:${dans_conteneur}" "$destination"
compose exec -T backend rm -f "$dans_conteneur"
chmod 600 "$destination" # endpoints et clés push : données personnelles

echo "✓ Sauvegarde : ${destination}"

# Rotation : ne garder que les N plus récentes (les noms se trient par date).
mapfile -t anciennes < <(ls -1 "$dossier"/abonnements-*.sqlite | sort -r | tail -n +"$((a_garder + 1))")
if [ "${#anciennes[@]}" -gt 0 ]; then
  rm -f -- "${anciennes[@]}"
  echo "  ${#anciennes[@]} ancienne(s) sauvegarde(s) supprimée(s), ${a_garder} conservée(s)."
fi
