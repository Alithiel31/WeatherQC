# Node 26 : LTS depuis le 2026-10-28 et suivie jusqu'au 2029-04-30, un an de
# plus que la 24 qu'elle remplace. Règle inchangée : on ne monte de version
# majeure qu'une fois celle-ci passée LTS, jamais du Current sur le Raspberry Pi.
# Dependabot proposera la 27, puis la 28, parce que ce sont les tags les plus
# récents ; ce n'est pas le même critère — la prochaine montée sera la 28, à son
# passage LTS (octobre 2028).

# ── deps : dépendances complètes (dev + prod) ─────────────────────────────
FROM node:26-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── development : tsx --watch, montage de volume ──────────────────────────
FROM deps AS development
COPY . .
ENV NODE_ENV=development CHOKIDAR_USEPOLLING=true
CMD ["npm", "run", "dev"]

# ── build : compile TypeScript → dist/ ────────────────────────────────────
FROM deps AS build
COPY . .
RUN npx tsc

# ── production : image minimale, cible de docker-compose ──────────────────
FROM node:26-alpine AS production
# Applique les derniers correctifs de sécurité Alpine : l'image de base peut ne
# pas avoir été republiée depuis la sortie d'un correctif upstream,
# indépendamment de l'âge du tag. Couvre notamment libssl3/libcrypto3
# (CVE-2026-14456, DoS QUIC côté serveur OpenSSL — sans lien avec ce backend
# qui n'expose pas de serveur QUIC, mais bloquant le scan CI) : une mise à jour
# ciblée de ces deux paquets, en plus de celle-ci, ne changeait rien.
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Le processus ne tourne plus en root : une faille dans l'API ou une dépendance
# ne donne plus un shell root dans le conteneur. `node` (UID 1000) existe déjà
# dans l'image de base ; l'UID numérique, et non le nom, pour qu'un orchestrateur
# puisse vérifier que le conteneur n'est pas root (hadolint DL3066).
#
# Le code reste à root, en lecture seule pour `node` : un processus compromis ne
# peut pas le réécrire. Seul `/app/data` — le volume des abonnements, voir
# `docker-compose.yml` — appartient à `node`. Créé ici pour qu'un volume neuf en
# hérite ; un volume existant garde son propriétaire, d'où le service
# `backend-data-init` du compose.
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production PORT=3005
EXPOSE 3005
USER 1000
CMD ["node", "dist/app.js"]
