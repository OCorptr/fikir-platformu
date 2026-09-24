# Frontend Dockerfile (Sprint 9).
# Multi-stage: Node build + nginx static serve.
# nginx reverse proxy kurulumu önerilir (DEPLOYMENT.md); bu Dockerfile sadece
# docker-compose ile hızlı başlangıç için.

# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm install (lockfile varsa frozen-lockfile ile deterministik)
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate \
 && (test -f pnpm-lock.yaml && pnpm install --frozen-lockfile || pnpm install)

COPY . .
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html

# Basit SPA config (tüm route'lar index.html'e)
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static asset cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Güvenlik header'ları (frontend'in eklediği CSP/HSTS yok, nginx ekler)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
