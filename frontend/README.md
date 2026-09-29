# Geleceğin Fikri Frontend

React 19 + Vite 8 + TypeScript 7 tabanlı statik frontend uygulaması.

## Komutlar

`package.json` (`scripts` bloğu) — başka komut yok:

```powershell
pnpm install
pnpm dev        # vite            → http://localhost:5173
pnpm build      # tsc -b && vite build → dist/
pnpm typecheck  # tsc -b --pretty false
pnpm preview    # vite preview    → http://localhost:4173
```

### Paket yöneticisi ve iki kilit dosyası

- **Yerel geliştirme:** `pnpm@11.19.0` (`package.json` → `packageManager` alanı),
  `pnpm-lock.yaml` bu kilidi yönetir.
- **Render Static Site build'i:** repo kökündeki `render.yaml` → `buildCommand: npm ci && npm run build`.
  Bu yüzden `package-lock.json` **yalnızca** Render için tutulur ve `npm ci` ile
  `pnpm-lock.yaml` yeniden üretilmez.
- Bağımlılık eklerken/guncellerken **`bash scripts/sync-npm-lock.sh`** çalıştır —
  aksi halde Render build'i eski kilitle çalışır.
- `frontend/Dockerfile` build aşaması `corepack enable` + `pnpm install --frozen-lockfile`
  kullanır (node:22-alpine).

### Bağımlılıklar (tam liste)

| Paket | Sürüm |
|---|---|
| react / react-dom | 19.3.0 |
| react-router-dom | 7.18.4 |
| typescript (dev) | 7.0.2 |
| vite (dev) | 8.3.0 |
| @vitejs/plugin-react (dev) | 6.1.1 |
| @types/react, @types/react-dom (dev) | 19.3.0 |

Yalnızca **3 runtime dependency** var; her şey geri kalanı native.

## Geliştirme sunucusu

`vite.config.ts`: `server` **ve** `preview` portları `/api` isteklerini
`http://localhost:5000` adresine proxy'ler. SPA fallback nginx'te
(`try_files $uri $uri/ /index.html`), Render'da `infra/render.yaml` blueprint'inde
`/*` → `/index.html` rewrite kuralı olarak tanımlıdır.

## Test

**Frontend'de birim test çatısı yok** (Vitest/Jest kurulu değil — Sprint 12 backlog'unda
"Frontend test (Vitest)" olarak duruyor). UI doğrulaması **manuel Playwright** ile yapılır:
`public/mobil-test.html` gerçek CSS'i yükleyip ölçüm sayfasıdır, `.playwright-cli/` yereldir.
`scripts/verify.ps1` yalnızca `pnpm typecheck` + `pnpm build` çalıştırır.

## Rotalar (`src/App.tsx` — tek doğruluk kaynağı)

| Yol | Bileşen | Koruma |
|---|---|---|
| `/` | `HomePage` | — |
| `/giris` | `HomePage` (giriş modalı açık) | — |
| `/fikir` | `FikirPage` | — |
| `/mfa-setup` | `MfaSetupPage` | — |
| `/mfa-login` | `MfaLoginPage` | — |
| `/sifremi-unuttum` | `SifremiUnuttumPage` | — |
| `/sifre-sifirla` | `SifreSifirlaPage` | — |
| `/sifre-degistir` | `SifreDegistirPage zorunlu={false}` | `SifreKilit` (parola yaşı) |
| `/il-panel` | `ProvinceInboxPage` | `ProtectedRoute context="province"` |
| `/il-panel/adaylar` | `CandidatesPage` | aynı |
| `/il-panel/ekip` | `EkipPage` | aynı |
| `/il-panel/rapor` | `ProvinceReportPage` | aynı |
| `/il-panel/fikir/:id` | `ApplicationDetailPage` | aynı |
| `/bakanlik` | `MinistryPage gorunum="adaylar"` | `ProtectedRoute context="ministry"` |
| `/bakanlik/donemler` | `MinistryPage gorunum="donemler"` | aynı |
| `/admin` | → `/admin/users` (yönlendirme) | `AdminAuthGuard` |
| `/admin/users` | `UserListPage` | `AdminAuthGuard` |
| `/admin/users/bulk` | `UserBulkPage` | `AdminAuthGuard` |
| `/admin/users/:id` | `UserEditPage` | `AdminAuthGuard` |
| `/admin/oauth` | `OAuthAyarlaPage` | `AdminAuthGuard` |
| `/admin/raporlar` | `DenetimRaporlariPage` | `AdminAuthGuard` |
| `/admin/kullanicilar` | → `/admin/users` (eski yol) | aynı |
| `*` | `SayfaBulunamadi` | — |

Tüm `<Routes>` `SifreKilit` (90 günlük parola yaşı kilidi) ve
`GenelHataSinir` (React render hata sınırı) içinde; gövde sınıfını
`GovdeSinifi`, üst bar'ı `KosulluUstBar` yönetir.

## API bağlantısı

`src/services/api.ts`:

- `VITE_API_BASE_URL` tanımlıysa o kullanılır (cross-origin dağıtım).
- Tanımlı **değilse** kodda **hiçbir adres gömülü değildir** (Sprint 11.58'te kaldırıldı):
  `apiUrl()` relative `/api/...` üretir, `backendApiUrl()` tarayıcının kendi
  `window.location.origin`'ini kullanır → nginx/Docker aynı-origin kurulumu için doğru davranış.
- Node/Vite ortamında (pencere yokken) `VITE_DEV_BACKEND_ORIGIN`, o da yoksa
  `http://localhost:5000`.
- Tüm isteklerde `credentials: "include"` (HttpOnly cookie). Hata ayrıştırma
  sırası: `message` → `errors[]` → RFC 7807 `detail` → `title` → Türkçe HTTP fallback.
- İstek zaman aşımı 25 sn.

`frontend/.env.example` bu değişkeni açıklar. Build-time değer, Docker'da
`--build-arg VITE_API_BASE_URL=...` ile `docker-compose.yml` üzerinden geçer.

## Dizin düzeni

```
src/
├── App.tsx            # rotalar, GovdeSinifi, KosulluUstBar, hata sınırı
├── main.tsx
├── types.ts           # backend DTO'larıyla birebir uyumlu tipler
├── styles.css         # ana tema (index.html'de Vite CSS'inden SONRA yüklenir)
├── admin-theme.css    # admin paneli tema katmanı
├── components/        # AuthModal, YetkiliGirisModal, ProtectedRoute, AdminAuthGuard,
│                      # SifreKilit, UstBar, AccessibilityPanel, CaptchaField,
│                      # YetkiliPanelSecim, KullaniciCikis, ErisilebilirlikYardimci
├── pages/             # route bileşenleri (+ pages/admin/ altında admin paneli)
└── services/          # api, auth, admin, ideas, implementations, ministry,
                       # province, references, roles, sifreKurallari
public/                # değişmeyen varlıklar: assets/css, assets/fonts, assets/img,
                       # gizlilik-politikasi.html, kullanim-kosullari.html, mobil-test.html
```

> ⚠️ `index.html` içinde `public/assets/css/stil.css` elle `<link>`'lenir, Vite'in
> ürettiği `/assets/index-*.css` ise her zaman **en son** yüklenir. `src/` CSS'i
> `stil.css`'i ezebilir (Sprint 11.68'de `button.ozellik` rozeti bu yüzden görünmüyordu).

## Deploy

- **Aktif:** Render Static Site — `https://fikir-platformu-web.onrender.com`.
  Build komutu `npm ci && npm run build`, yayın yolu `dist/`
  (repo kökü `render.yaml`, Sprint 11.57). SPA rewrite + `/index.html` no-cache,
  `/assets` 1 yıl immutable tanımları `infra/render.yaml` içinde duruyor.
- **Self-hosted:** `frontend/Dockerfile` (nginx 1.27-alpine): statik sunum +
  `/api/` → `http://backend:8080` proxy + güvenlik header'ları. Ayrı sunucuya
  kurulum için `deploy/nginx/fikir.conf` (bkz. `DEPLOYMENT.md`).

`frontend/netlify.toml` Netlify için duruyor; aktif deploy Render'dır.
