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
RUN npm run build

# ── production : nginx sert les fichiers statiques ────────────────────────
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
