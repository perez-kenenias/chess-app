# chess-frontend/Dockerfile — build de producción de Vite + nginx
#
# VITE_API_URL se "hornea" en el build (es una app estática, no puede leer
# variables de entorno en tiempo de ejecución). Por defecto vale "/api" para
# que nginx.conf haga proxy al servicio "backend" de docker-compose.

# ── Etapa 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Etapa 2: servir con nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://localhost/ || exit 1
