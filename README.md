# Geleceğin Fikri Platformu

YEĞİTEK için geliştirilen dijital fikir paylaşım platformu — öğrenci, il yöneticisi ve bakanlık yetkilileri için. MEB altyapısında çalışacak şekilde tasarlanmıştır.

**Mimari**: Tek repo, üç ortam (Render demo, YEĞİTEK kendi sunucuları, lokal geliştirme). Infrastructure-as-Code.

## Katkıda bulunanlar için giriş noktaları

| Konu | Dosya |
|---|---|
| **AI agent talimatı** | [`AGENTS.md`](AGENTS.md) |
| **Derin mimari + bug tarihçesi** | [`CLAUDE.md`](CLAUDE.md) |
| **Aktif sprint durumu** | [`HANDOVER.md`](HANDOVER.md) |
| **Ürün/hedefler** | [`docs/GELECEGIN_FIKRI_PROJE_PLANI.md`](docs/GELECEGIN_FIKRI_PROJE_PLANI.md) |
| **Mimari diyagramlar** | [`docs/architecture.md`](docs/architecture.md) |
| **Operasyon / troubleshooting** | [`docs/runbook.md`](docs/runbook.md) |
| **Aşama 0-10 geçmiş kaydı (arşiv)** | [`docs/DURUM.md`](docs/DURUM.md) |
| **Deployment rehberi** | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| **Gmail OAuth2 kurulumu** (MFA Email OTP için) | [`docs/GOOGLE-OAUTH-SETUP.md`](docs/GOOGLE-OAUTH-SETUP.md) |
| **Güvenlik politikası** | [`SECURITY.md`](SECURITY.md) |
| **YEĞİTEK 41 maddelik güvenlik listesi + durum** | [`docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md`](docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md) |
| **Kuruma teslim edilmesi bekleyen bilgiler** | [`docs/YEGITEK-TESLIM-BEKLEYEN-BILGILER.md`](docs/YEGITEK-TESLIM-BEKLEYEN-BILGILER.md) |

## Sprint özeti (aktif)

| Sprint | Kapsam |
|---|---|
| Sprint 0 | DNS tema, ana sayfa, navigasyon |
| Sprint 1-3 | CAPTCHA, Authentication, MFA planı, Identity scheme mimarisi |
| Sprint 4 | Atomic file cabinet + DB geçişi (PostgreSQL → TiDB Cloud MySQL) |
| Sprint 5-6 | Persistent volume, password reset, MFA kilit, rate limit |
| Sprint 7 | MFA TOTP zorunluluğu (privileged roller) |
| Sprint 8 | İl değerlendirme akışı |
| Sprint 9 | SystemAdmin kullanıcı yönetimi + MFA setup/verify + docker-compose |
| Sprint 10 | MFA Email OTP yöntemi + cross-context guard + Gmail API OAuth2 + Render.yaml cache headers + atomic deploy hard reset |
| Sprint 11 | Admin panel (user CRUD, bulk CSV, privacy guard), Gmail refresh token DB-persist, dokümantasyon sistemi |
| Sprint 11.51-11.55 | YEĞİTEK güvenlik sertleştirme: parola politikası (YG-16), pasif hesap yönetimi (YG-39), CSP/HSTS, gömülü origin'lerin kaldırılması, Linux doğrulama ve paketleme betikleri |
| Sprint 11.56-11.63 | Render frontend build'i `package-lock.json` ile düzeltildi, RFC 2047 gönderen adı (mojibake), CSV beyaz listesi (YG-03/31/32) |
| Sprint 11.64-11.68 | Admin paneli görsel birleştirme, rol filtreleri, `sifreKurallari.ts` tek doğruluk kaynağı |
| Sprint 11.69-11.78 | Rol bazlı 90 günlük parola yaşı, tüm sayfalarda çıkış, panel seçim ekranı, `/me` context düzeltmesi (adac877) |
| Sprint 11.79-11.81 | Kenar paneli menüsü panele göre, il yönetimi yetkisi tek kurala bağlandı, tüm sayfalarda mobil uyumluluk ölçüldü |
| Sprint 12 (sıradaki) | Per-user Gmail mimarisi, maintenance endpoint'leri kaldır, AWS SES migration, i18n |

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

Restore + Release derleme + xUnit testleri (23) + frontend tip kontrolü + frontend üretim derlemesi.

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
│   ├── FikirPlatformu.slnx
│   ├── src/
│   │   ├── FikirPlatformu.Api/    # Endpoints + Program.cs + DI
│   │   ├── FikirPlatformu.Application/
│   │   ├── FikirPlatformu.Domain/
│   │   └── FikirPlatformu.Infrastructure/   # Email sender + Identity + Migrations
│   ├── tests/FikirPlatformu.Tests/          # xUnit (23 test)
│   └── README.md
├── frontend/                      # React 19 + Vite 8 + TypeScript 7
│   ├── Dockerfile                 # nginx multi-stage build
│   ├── src/
│   │   ├── pages/                 # Route componentleri
│   │   ├── components/            # AuthModal, YetkiliGirisModal
│   │   └── services/              # api.ts, auth.ts, admin.ts, roles.ts
│   └── README.md
├── infra/
│   └── render.yaml                # Render Blueprint — headers, SPA, services
├── AGENTS.md                      # AI agent talimatı (build/test/kırmızı çizgiler)
├── CLAUDE.md                      # Derin mimari + bug-fix tarihçesi
├── HANDOVER.md                    # Aktif sprint state + açık işler
├── docker-compose.yml             # YEĞİTEK self-hosted (MySQL)
├── deploy/nginx/fikir.conf        # Reverse proxy config (TLS 1.2+, /api proxy, SPA)
├── docs/
│   ├── architecture.md            # Mimari diyagramlar, veri akışları
│   ├── runbook.md                 # Operasyon + maintenance endpoint'ler
│   ├── DURUM.md                   # ⚠️ Aşama 0-10 arşiv kaydı
│   ├── GELECEGIN_FIKRI_PROJE_PLANI.md
│   ├── GOOGLE-OAUTH-SETUP.md      # MFA Email OTP için Gmail OAuth2 kurulumu
│   └── adr/0001-sistem-sabit-gmail.md
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
- **MFA:** TOTP (Google/MS Authenticator) veya Email OTP — kullanıcı seçer. `/api/auth/mfa/{setup,verify-setup,verify,send-email-otp,disable,cancel}` endpointleri. TOTP secret'ları Data Protection API ile şifrelenmiş.
- **Email:** 4 mod (geliştirme test, Gmail API OAuth2 HTTPS, SMTP fallback, Resend HTTPS API). Refresh token önce `Mail__Gmail__RefreshToken` env'inden, yoksa DB'deki şifreli kayıttan (`gmail_refresh_tokens`, PBKDF2) okunur (Sprint 11.36+).
- **Frontend SPA fallback:** Render rewrite `/*` → `/index.html`. Vite build hash'li asset isimleri üretir (`index-<hash>.js`).

## İlk kurulum

```bash
cp .env.example .env
# .env içindeki CHANGE_ME değerlerini kendi kurumunuza göre doldurun.
#   Zorunlu: DB_CONNECTION_STRING, AdminMaintenance__Secret,
#            SeedSystemAdmin__Email, SeedSystemAdmin__Password,
#            Frontend__BaseUrl, Mail__*
#
# ⚠️ Değişken adları kodla BİREBİR aynı olmalıdır. Uygulama `A:B:C`
#    yapısını env'de `A__B__C` olarak okur; yanlış ad sessizce yok sayılır
#    ve kurulum "başarılı" görünürken ayar uygulanmamış olur.

docker compose up -d                 # kendi MySQL'iniz varsa
docker compose --profile with-mysql up -d   # MySQL container ile

# Doğrulama (gizli sızıntı taraması dahil)
./scripts/verify.sh          # Linux/macOS
powershell -File scripts/verify.ps1   # Windows
```

Sistem yöneticisi hesabı veritabanı boşsa otomatik oluşur
(`SeedSystemAdmin__Email` + `SeedSystemAdmin__Password`).
Ayrıca elle: `dotnet run --project backend/src/FikirPlatformu.Api -- seed`

> 🔒 Bu depoda hiçbir gerçek parola, API anahtarı veya test hesabı şifresi bulunmaz.
> `scripts/make_handover.sh` paketlemeden önce canlı sırların commit edilmediğini denetler.

## Lisans / telif

MEB / YEĞİTEK projesi — iç kullanım.
