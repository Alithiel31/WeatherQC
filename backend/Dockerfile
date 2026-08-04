# Node 24 et non 26 : au 2026-08, la 26 est encore une version *Current* — elle
# ne passe LTS que le 2026-10-28. La 24 est LTS depuis le 2025-10-28 et suivie
# jusqu'au 2028-04-30, soit deux ans de plus que la 22 qu'elle remplace, sans
# jamais faire tourner du Current sur le Raspberry Pi. Dependabot proposera la
# 26 parce que c'est le tag le plus récent ; ce n'est pas le même critère.

# ── deps : dépendances complètes (dev + prod) ─────────────────────────────
FROM node:24-alpine AS deps
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
FROM node:24-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production PORT=3005
EXPOSE 3005
CMD ["node", "dist/app.js"]
