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
ARG VITE_OPENWEATHERMAP_KEY
ENV VITE_OPENWEATHERMAP_KEY=$VITE_OPENWEATHERMAP_KEY
RUN npm run build

# ── production : nginx sert les fichiers statiques ────────────────────────
FROM nginx:alpine AS production
# Applique les derniers correctifs de sécurité Alpine (ex. CVE-2026-14456 sur
# libssl3/libcrypto3) : l'image de base peut ne pas avoir été republiée depuis
# la sortie du correctif upstream, indépendamment de l'âge du tag.
RUN apk update && apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
