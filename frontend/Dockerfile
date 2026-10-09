# Node 24 et non 26 : cf. le commentaire en tête de `backend/Dockerfile`.
# La 26 n'est LTS qu'à partir du 2026-10-28.

# ── development : vite dev server avec hot-reload ─────────────────────────
FROM node:24-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV CHOKIDAR_USEPOLLING=true
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ── build : vite build → dist/ ────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite embarque les variables VITE_* dans le bundle au build, pas au runtime —
# elle doit donc être fournie ici plutôt que via `env_file` en production.
#
# hadolint signale ces quatre lignes (DL3064, « donnée potentiellement sensible ») :
# ce sont des clés gratuites, publiques par construction, lisibles dans le bundle
# servi au navigateur — voir `frontend/.env.example`. Aucun secret ne passe ici.
# hadolint ignore=DL3064
ARG VITE_OPENWEATHERMAP_KEY
# hadolint ignore=DL3064
ARG VITE_CARTO_API_KEY
# hadolint ignore=DL3064
ENV VITE_OPENWEATHERMAP_KEY=$VITE_OPENWEATHERMAP_KEY
# hadolint ignore=DL3064
ENV VITE_CARTO_API_KEY=$VITE_CARTO_API_KEY
RUN npm run build

# ── production : nginx sert les fichiers statiques ────────────────────────
#
# `nginx-unprivileged` et non `nginx` : l'image officielle lance son processus
# principal en root pour pouvoir écouter sur le port 80. Celle-ci tourne en
# UID 101 de bout en bout, d'où le port 8080 (un non-root ne peut pas lier un
# port < 1024) et ses fichiers temporaires dans /tmp. Même base Alpine, même
# nginx : c'est l'image que maintient l'équipe nginx elle-même.
FROM nginxinc/nginx-unprivileged:alpine AS production
# Applique les derniers correctifs de sécurité Alpine (ex. CVE-2026-14456 sur
# libssl3/libcrypto3) : l'image de base peut ne pas avoir été republiée depuis
# la sortie du correctif upstream, indépendamment de l'âge du tag.
#
# `apk` exige root : on le reprend le temps de cette seule commande.
USER 0
RUN apk update && apk upgrade --no-cache
USER 101
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
