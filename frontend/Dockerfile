# ── development : vite dev server avec hot-reload ─────────────────────────
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV CHOKIDAR_USEPOLLING=true
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ── build : vite build → dist/ ────────────────────────────────────────────
FROM node:22-alpine AS build
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
