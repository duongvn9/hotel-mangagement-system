# syntax=docker/dockerfile:1
# Firebase Web config là thông tin public (nằm trong bundle JS), không phải secret.
# check=skip=SecretsUsedInArgOrEnv
# Build context là thư mục gốc repo (cần cả frontend/ và design-system/).
#   docker build -f frontend/Dockerfile .

# ---------- deps ----------
FROM node:24-alpine AS deps
WORKDIR /app/frontend
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- dev: Vite dev server (docker-compose.yml) ----------
FROM deps AS dev
COPY design-system /app/design-system
COPY frontend /app/frontend
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---------- build ----------
FROM deps AS build
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_APP_NAME="Grand Emily HMS"
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_APP_ID=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
COPY design-system /app/design-system
COPY frontend /app/frontend
RUN npm run build

# ---------- prod: nginx (không chạy bằng root) phục vụ file tĩnh + proxy /api ----------
FROM nginxinc/nginx-unprivileged:1.29-alpine AS prod
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
