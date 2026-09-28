# Geleceğin Fikri Frontend

React 19 + Vite 8 + TypeScript 7 tabanlı statik frontend uygulaması.

## Komutlar

```powershell
pnpm install
pnpm dev        # http://localhost:5173
pnpm typecheck
pnpm build      # dist/
```

Paket yöneticisi **pnpm 11** (`packageManager: pnpm@11.19.0`, `pnpm-lock.yaml`).

Geliştirme sunucusu `/api` isteklerini varsayılan olarak `http://localhost:5000` adresine yönlendirir.

## Deploy

- **Aktif:** Render Static Site — `https://fikir-platformu-web.onrender.com`.
  Yapılandırma `infra/render.yaml` Blueprint'inde: `index.html` no-cache,
  `/assets/*` 1 yıl immutable, SPA fallback `/*` → `/index.html`.
- **Self-hosted:** nginx — `/opt/fikir-platformu/frontend/dist` (bkz. `DEPLOYMENT.md`).

`frontend/netlify.toml` Netlify için duruyor; aktif deploy Render'dır.

## API bağlantısı

`services/api.ts` içindeki `backendApiUrl()` yardımcısı production'da absolute
`https://fikir-platformu.onrender.com` adresini kullanır. Env'de
`VITE_API_BASE_URL` tanımlıysa o tercih edilir.
