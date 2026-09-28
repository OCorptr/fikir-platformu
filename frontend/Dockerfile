# Frontend Dockerfile (Sprint 9, Sprint 11.52'de güncellendi).
# Multi-stage: Node build + nginx static serve + /api reverse proxy.
#
# Bu container hem statik sunumu hem de /api/* → backend proxy'sini yapar.
# Böylece `docker compose up -d` tek origin üzerinden çalışır ve CORS'a gerek kalmaz.
# Ayrı origin dağıtım (kendi domain'inde nginx) için DEPLOYMENT.md → deploy/nginx/fikir.conf

# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm sürümü package.json'daki packageManager alanıyla sabitlenir.
# (corepack prepare pnpm@latest KULLANILMAZ — sürüm her build'de değişirdi.)
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable \
  && (test -f pnpm-lock.yaml && pnpm install --frozen-lockfile || pnpm install)

COPY . .
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm run build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html

# SPA + /api proxy config.
# backend konteyner adı compose ağı içinde 'backend'; nginx DNS ile çözer.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # --- Backend API (compose ağı içinde) ---
    location /api/ {
        proxy_pass         http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Connection        "";
        proxy_buffering    off;
        proxy_read_timeout 60s;
    }

    # Sağlık kontrolü — erişim günlüğüne girmesin
    location = /api/health {
        proxy_pass http://backend:8080;
        access_log off;
    }

    # --- Frontend statik ---
    # SPA fallback: tüm route'lar index.html'e düşer (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Vite hash'li asset'ler — 1 yıl immutable
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # index.html asla cache'lenmesin (yeni build görünür olsun)
    location = /index.html {
        add_header Cache-Control "no-store, must-revalidate";
    }

    # --- Güvenlik header'ları ---
    add_header X-Frame-Options           "DENY" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy        "geolocation=(), microphone=(), camera=(), payment=()" always;
}
EOF

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
