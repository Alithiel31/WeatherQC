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
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production PORT=3005
EXPOSE 3005
CMD ["node", "dist/app.js"]
