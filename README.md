# Geleceğin Fikri Platformu

YEĞİTEK için geliştirilen dijital fikir paylaşım platformu — öğrenci, il yöneticisi ve bakanlık yetkilileri için. MEB altyapısında çalışacak şekilde tasarlanmıştır.

**Mimari**: Tek repo, üç ortam (Render demo, YEĞİTEK kendi sunucuları, lokal geliştirme). Infrastructure-as-Code.

## Katkıda bulunanlar için giriş noktaları

| Konu | Dosya |
|---|---|
| **Ürün/hedefler** | [`docs/GELECEGIN_FIKRI_PROJE_PLANI.md`](docs/GELECEGIN_FIKRI_PROJE_PLANI.md) |
| **Aktif durum** | [`docs/DURUM.md`](docs/DURUM.md) |
| **Deployment rehberi** | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| **Gmail OAuth2 kurulumu** (MFA Email OTP için) | [`docs/GOOGLE-OAUTH-SETUP.md`](docs/GOOGLE-OAUTH-SETUP.md) |
| **Güvenlik politikası** | [`SECURITY.md`](SECURITY.md) |

## Sprint özeti (aktif)

| Sprint | Kapsam |
|---|---|
| Sprint 0 | DNS tema, ana sayfa, navigasyon |
| Sprint 1-3 | CAPTCHA, Authentication, MFA planı, Identity scheme mimarisi |
| Sprint 4 | Atomic file cabinet + DB upgrade (TiDB Cloud uyumlu) |
| Sprint 5-6 | Persistent volume, password reset, MFA kilit, rate limit |
| Sprint 7 | MFA TOTP zorunluluğu (privileged roller) |
| Sprint 8 | İl değerlendirme akışı |
| Sprint 9 | SystemAdmin kullanıcı yönetimi + MFA setup/verify + docker-compose |
| Sprint 10 | MFA Email OTP yöntemi + cross-context guard + Gmail API OAuth2 + Render.yaml cache headers + atomic deploy hard reset |
| Sprint 11+ | Sprint 11 planı: production'da refresh token DB'de, Kubernetes manifests, captcha rate limit polish |

## Yerel geliştirme

Gereksinimler:

- .NET SDK 10
- Node.js 24 veya üzeri
- pnpm 11
- MySQL 8+ (veya TiDB Cloud connection string)
- Docker / Podman (opsiyonel, `docker-compose` ile MySQL dahil)

### Hızlı başlangıç

```powershell
# Backend
dotnet run --project backend/src/FikirPlatformu.Api

# Frontend (ayrı terminal)
Set-Location frontend
pnpm install
pnpm dev
```

Backend: `http://localhost:5000` (veya launchSettings.json'dan)
Frontend: `http://localhost:5173` (Vite dev server, `/api/*` → backend proxy)

### Doğrulama

```powershell
./scripts/verify.ps1
```

Tüm lint + tip kontrolü + build.

## Deployment ortamları

| Ortam | Yöntem | Detay |
|---|---|---|
| **Render.com (demo)** | `infra/render.yaml` Blueprint | Dashboard'dan "New + Blueprint" ile repo seçildiğinde otomatik kurulur |
| **YEĞİTEK kendi sunucuları** | `docker-compose.yml` | `docker compose up -d` — kendi MySQL'i varsa profile yok, yoksa `--profile with-mysql` |
| **Lokal** | Aynı `docker-compose.yml` (veya adım adım `dotnet run` + `pnpm dev`) | Geliştirme için |

Her ortam **aynı repo**'yu kullanır. `.env.example` ortam bağımsız şablon — production'da gerçek credentials doldurulur.

## Repo yapısı

```
.
├── backend/                       # .NET 10 + EF Core 9 + Pomelo MySQL
│   ├── Dockerfile                 # Render + docker-compose
│   ├── src/
│   │   ├── FikirPlatformu.Api/    # Endpoints + Program.cs + DI
│   │   ├── FikirPlatformu.Application/
│   │   ├── FikirPlatformu.Domain/
│   │   └── FikirPlatformu.Infrastructure/   # Email sender + Identity
│   └── README.md
├── frontend/                      # React 19 + Vite 8 + TypeScript 7
│   ├── Dockerfile                 # nginx multi-stage build
│   ├── src/
│   │   ├── pages/                 # Route componentleri
│   │   ├── components/            # AuthModal, YetkiliGirisModal
│   │   └── services/              # api.ts, auth.ts (mfaGetMethod, mfaSendEmailOtp)
│   └── README.md
├── infra/
│   └── render.yaml                # Render Blueprint — headers, SPA, services
├── docker-compose.yml             # YEĞİTEK self-hosted
├── docs/
│   ├── DURUM.md                   # Aktif sprint durumu
│   ├── GELECEGIN_FIKRI_PROJE_PLANI.md
│   └── GOOGLE-OAUTH-SETUP.md      # MFA Email OTP için Gmail OAuth2 kurulumu
├── scripts/
│   ├── verify.ps1                 # CI test runner
│   └── zip_yegitek.ps1            # YEĞİTEK teslim ZIP paketleyici
├── SECURITY.md
├── DEPLOYMENT.md
└── README.md
```

## Mimari kararlar

- **Backend:** .NET 10, EF Core 9 + Pomelo MySQL provider, Identity (Application + Province + Ministry + PreMfa scheme'leri, PreMfa MFA halfway cookie)
- **Frontend:** React 19 + Vite 8 + TypeScript 7, üç runtime dependency (react, react-dom, react-router)
- **DB:** MySQL 8+ (Pomelo provider), TiDB Cloud uyumlu, `SchemaBehavior.Ignore` (Pomelo MySQL "public" schema hatasını önler)
- **MFA:** TOTP (Google/MS Authenticator) veya Email OTP — kullanıcı seçer. `/api/auth/mfa/setup`, `/verify`, `/verify-setup`, `/send-email-otp`, `/cancel` endpointleri. TOTP secret'ları AES-256 ile şifrelenmiş.
- **Email:** 4 mod (geliştirme test, Gmail API OAuth2 HTTPS, SMTP fallback, Resend HTTPS API). OAuth2 handshake tek seferlik; refresh token kalıcı (şu anda env var — Sprint 11'de DB).
- **Frontend SPA fallback:** Render rewrite `/*` → `/index.html`. Vite build hash'li asset isimleri üretir (`index-vCANEMN9.js`).
- **Cross-context guard:** Bir context'te (student/province/ministry) oturum açıksa diğer context'in modalinde form gizlenir.

## Test verileri

SystemAdmin + MinistryOfficial + 3 İl yöneticisi + 3 Evaluator + demo Student — `seed/ilk_hesaplar.py` ile seed edilir.

## Lisans / telif

MEB / YEĞİTEK projesi — iç kullanım.
