# CLAUDE.md — Claude Project Memory

> Bu dosya **Claude** (ve Magic Context) için project memory. AGENTS.md'den daha derin:
> mimari, sprint state, kritik dosyalar, yapılan önemli kararlar, bug-fix tarihçesi.
> Yeni oturumda: AGENTS.md → CLAUDE.md → HANDOVER.md oku.

---

## 🧠 Projenin hikayesi (neden burada)

Onur (kullanıcı) ulusal YEGİTEK projesi için fikir değerlendirme platformu geliştiriyor. Domain: il AR-GE birimleri + bakanlık yetkilileri öğrenci/teknisyen fikirlerini değerlendirir. İleride `fikrimnet.gov.tr`'de host edilecek.

**Kullanıcı profili:** Windows kernel driver developer (O-Freeze projesi ayrı, dormant). Caveman modu ile iletişim kurar (Türkçe ultra-terse). Onay kısa: "ONAYLIYORUM", "A", "devam et".

---

## 📊 Stack detayları (derinlemesine)

### Backend — .NET 10 + EF Core 9

- **Mimari:** Clean-ish (API / Application / Infrastructure / Domain). `FikirPlatformu.Api`, `FikirPlatformu.Application`, `FikirPlatformu.Infrastructure`, `FikirPlatformu.Domain`.
- **Auth:** ASP.NET Core Identity 9. 4 cookie scheme: `IdentityConstants.ApplicationScheme` (öğrenci + yetkili), `ProvinceScheme`, `MinistryScheme`, `PreMfaScheme` (login sonrası MFA öncesi yarım cookie). `SignInManager` ile cookie set.
- **MFA:** TOTP (RFC 6238) + Email OTP. `TotpAuthenticator` + custom `IUserTwoFactorTokenProvider<ApplicationUser>` `EmailOtpTokenProvider`. Secret DB'de encrypted.
- **Email sender factory:** 4 mod — GmailApiEmailSender (HTTPS OAuth2, port 443, Render SMTP bloklu) > ResendHttpEmailSender > SMTP > DevelopmentEmailSender. Mod seçici `Program.cs:99`. Sistem sabit Gmail (`Mail__Type=gmail`, `Mail__Gmail__*` env).
- **PasswordHash:** PBKDF2 default. Identity `PasswordOptions`: `RequiredLength=8`, `RequireUppercase=true`, `RequireLowercase=true`, `RequireDigit=false`, `RequireNonAlphanumeric=false`. (Sprint 11.52: rakam/özel karakter zorunluluğu kaldırıldı — kurum uyum şifreleri. **YEĞİTEK madde 16 ile çelişiyor, Sprint 12'de karar verilecek.**)
- **İlk admin seed (Sprint 11.52):** Kod içi gömülü hesap **kaldırıldı**. `SeedSystemAdmin__Email` + `SeedSystemAdmin__Password` ortam değişkenleri tanımlıysa **ve veritabanı boşsa** sistem yöneticisi oluşturulur. Hesap varsa dokunulmaz. Alternatif: `dotnet run -- seed` (`KurulumSeedAraci`).
- **Refresh token DB persist:** `GmailRefreshToken` entity (`gmail_refresh_tokens` tablosu). `HassasVeriSifreleme.SifreleGmail`/`CozGmail` PBKDF2 encrypt. Startup'ta idempotent `CREATE TABLE IF NOT EXISTS` raw SQL (EF CLI sandbox sorunu nedeniyle).

### Frontend — React 19 + Vite 8 + TypeScript 7

- **Runtime deps:** sadece 3 (`react`, `react-dom`, `react-router`). Tailwind/Yok. Custom CSS.
- **CSS:** Tek `frontend/src/styles.css` (~1800 satır). Class names kebab-case Türkçe.
- **Bundle:** Vite content-based hash. `dist/assets/index-<hash>.js` + `index-<hash>.css`.
- **Routing:** React Router v7 declarative. `<Routes>` + `<Route>`. **Kritik:** `useNavigate()` SPA navigation Modal context'inde çalışmıyor (Modal içinde pushState tetiklenmiyor). Modal navigation için `window.location.href` (full page load) gerekli.
- **HttpOnly cookies:** JS'den okunamaz. `document.cookie.split(...)` kontrolü yanlış — backend 200/401 response'a güven.
- **CORS bridge:** Frontend (`.onrender.com`) + Backend (`.onrender.com`) farklı domain. Relative URL SPA fallback'e düşer. `services/api.ts`'in `backendApiUrl()` helper'ı hardcoded `https://fikir-platformu.onrender.com` fallback.

### DB — TiDB Cloud Frankfurt

- MySQL-compatible. **Connection pooling kritik** (TiDB Cloud max 50 conn). `AddDbContext` default, `pooling=true` Pomelo MySQL provider default.
- Migration stratejisi: `dbContext.Database.Migrate()` startup'ta (Sprint 10 commit `ff0c430`). Yeni migration gerekirse lokal geliştirici makinede CI/temiz bash'te `dotnet ef migrations add` çalıştır.

---

## 🔐 Kritik konfigürasyon (Render env)

> 🔒 **Sprint 11.52:** Hiçbir gizli değer bu dosyada tutulmaz. Değerler Render dashboard
> → Environment listesinde ve `.env.example` şablonunda. Aşağıdaki liste yalnızca
> **hangi değişkenin** tanımlı olması gerektiğini gösterir.

| Değişken | Zorunlu | Not |
|---|---|---|
| `ConnectionStrings__MySql` | ✅ | SECRET — TiDB/MySQL bağlantı dizesi |
| `Mail__Type` | ✅ | `gmail` / `smtp` / `resend` / boş (mail GÖNDERİLMEZ) |
| `Mail__Gmail__ClientId` | gmail'de | Google OAuth client ID |
| `Mail__Gmail__ClientSecret` | gmail'de | **SECRET** |
| `Mail__Gmail__RedirectUri` | gmail'de | Google'da tanımlıyla birebir aynı olmalı |
| `Mail__Gmail__SenderAddress` | gmail'de | gönderen hesap |
| `Frontend__BaseUrl` | ✅ | doğrulama + şifre sıfırlama bağlantıları |
| `Cors__AllowedOrigins` | Render'da ✅ | **Sprint 11.52'den beri zorunlu.** Render'da frontend ayrı origin → boş bırakılırsa CORS middleware kurulmaz ve tüm API istekleri tarayıcıda bloke olur |
| `AdminMaintenance__Secret` | ✅ | **SECRET.** Sprint 11.52'de gömülü varsayılan anahtar silindi. Tanımlı değilse maintenance/debug endpoint'ler 403 döner |
| `SeedSystemAdmin__Email` | ilk kurulumda | Sistem yöneticisi e-postası |
| `SeedSystemAdmin__Password` | ilk kurulumda | **SECRET.** DB boşsa admin oluşturulur |

### SECRET (asla repo)

- `Mail__Gmail__ClientSecret` — Google Cloud Console'dan, Sprint 10.1 OAuth setup.
- ~~`Mail__Gmail__RefreshToken`~~ — **Artık DB'de persist.** Sprint 11.43 set-password-raw ile ilk atama, Sprint 11.36 OAuth handshake callback encrypted upsert. Render env'den **silindi**.

---

## 📁 Kritik dosyalar haritası

### Backend

| Dosya | Amaç |
|---|---|
| `backend/src/FikirPlatformu.Api/Program.cs` | Startup, CORS pipeline, Identity DI, route mapping, **maintenance endpoints** (`/api/__maintenance/*` + `/api/__debug/cors-config`) |
| `backend/src/FikirPlatformu.Api/Endpoints/AuthEndpoints.cs` | Login/logout/register/forgot-password/reset-password, Gmail OAuth start/callback, **debug state** (`SifreResetDebug`, `LoginDenemesi`) |
| `backend/src/FikirPlatformu.Api/Endpoints/MfaEndpoints.cs` | `/api/auth/mfa/*` → `setup`, `method`, `send-email-otp`, `verify-setup`, `verify`, `disable`, `cancel` |
| `backend/src/FikirPlatformu.Api/Endpoints/AdminEndpoints.cs` | `/api/admin/users*` CRUD, role whitelist, MFA reset, password reset, bulk CSV import |
| `backend/src/FikirPlatformu.Api/Endpoints/CaptchaEndpoints.cs` | `/api/auth/captcha/new` (mod 5), `/verify` |
| `backend/src/FikirPlatformu.Api/Endpoints/StudentIdeaEndpoints.cs` | `/api/student/ideas*` — öğrenci taslak/gönderim |
| `backend/src/FikirPlatformu.Api/Endpoints/ProvinceEndpoints.cs` | `/api/province/*` — inbox, read, assign, evaluators, evaluations, candidates, approve, implementations |
| `backend/src/FikirPlatformu.Api/Endpoints/MinistryEndpoints.cs` | `/api/ministry/periods*`, `/api/ministry/implementations` |
| `backend/tests/FikirPlatformu.Tests/` | xUnit — `IdeaTests`, `ProfanityTextMatcherTests`, `SubmitIdeaServiceTests` (17 test) |
| `backend/src/FikirPlatformu.Infrastructure/Email/GmailApiEmailSender.cs` | OAuth2 HTTPS, `EncodeSubjectRfc2047` (Türkçe karakter), HTML body base64 |
| `backend/src/FikirPlatformu.Infrastructure/Auth/GmailRefreshToken.cs` | Entity (encrypted token persist) |
| `backend/src/FikirPlatformu.Infrastructure/Security/HassasVeriSifreleme.cs` | PBKDF2 encrypt `SifreleGmail/CozGmail` |

### Frontend

| Dosya | Amaç |
|---|---|
| `frontend/src/App.tsx` | Routes (Sprint 11 — `/admin/users/bulk`, `/admin/users/:id`, `/admin/oauth`; `/admin/users/new` Sprint 11.49 kaldırıldı) |
| `frontend/src/services/api.ts` | `backendApiUrl()`, `ApiHttpError`, RFC 7807 `detail` parse |
| `frontend/src/services/admin.ts` | `listUsers`, `createUser`, `deleteUser`, `resetUserMfa`, `resetUserPassword` |
| `frontend/src/services/auth.ts` | `login`, `mfaGetMethod`, `mfaVerifyKod`, `mfaSetupTotp`, `mfaSetupEmail`, role-aware redirect helper |
| `frontend/src/services/roles.ts` | `rolAdi()` UI label mapper (DB adı → Türkçe) |
| `frontend/src/pages/MfaLoginPage.tsx` | `yukleniyor` state, OAuth handshake trigger on `yontemSec("Email")` |
| `frontend/src/pages/MfaSetupPage.tsx` | Method selection → TOTP/Email setup → verify |
| `frontend/src/components/YetkiliGirisModal.tsx` | `window.location.href` for navigation (Modal SPA nav bug) |
| `frontend/src/pages/admin/AdminLayout.tsx` | Admin panel shell (üst bar + sidebar) |
| `frontend/src/pages/admin/UserListPage.tsx` | 3-group accordion, il alt-groups, UserCreateModal trigger |
| `frontend/src/pages/admin/UserCreateModal.tsx` | **Sprint 11.49 yeni** — slide-in drawer, auto-password, form validation |
| `frontend/src/pages/admin/UserEditPage.tsx` | `/admin/users/:id` — kullanıcı detay/düzenleme |
| `frontend/src/pages/admin/UserBulkPage.tsx` | CSV import — Sprint 11.49 yeniden tasarım (3-adım rehber + sütun tablosu) |
| `frontend/src/pages/admin/OAuthAyarlaPage.tsx` | `/admin/oauth` — Gmail OAuth handshake trigger |
| `frontend/src/pages/ProvinceInboxPage.tsx` | `/il-panel` — gelen kutusu |
| `frontend/src/pages/CandidatesPage.tsx` | `/il-panel/adaylar` — aday havuzu |
| `frontend/src/pages/EkipPage.tsx` | `/il-panel/ekip` — evaluator yönetimi |
| `frontend/src/pages/ProvinceReportPage.tsx` | `/il-panel/rapor` — uygulama raporları |
| `frontend/src/pages/ApplicationDetailPage.tsx` | `/il-panel/fikir/:id` — puanla/onayla/uygulama raporu |
| `frontend/src/pages/MinistryPage.tsx` | `/bakanlik` + `/bakanlik/donemler` |
| `frontend/src/styles.css` | ~1800 satır, tüm component stilleri |

### Docs

| Dosya | Amaç |
|---|---|
| `AGENTS.md` | AI agent talimatı — build/test komutları, kırmızı çizgiler, conventions |
| `HANDOVER.md` | Sprint state + açık işler (bu dosyanın kardeşi) |
| `README.md` | Proje özeti |
| `DEPLOYMENT.md` | Render / nginx / systemd / docker-compose deployment |
| `SECURITY.md` | Güvenlik politikası + YEĞİTEK 41 madde uyum matrisi |
| `docs/GOOGLE-OAUTH-SETUP.md` | Gmail OAuth kurulum adımları |
| `docs/architecture.md` | **Sprint 11.50** — Mimari diyagramlar, veri akışları |
| `docs/runbook.md` | **Sprint 11.50** — Operations + maintenance endpoint rehberi |
| `docs/adr/0001-sistem-sabit-gmail.md` | **Sprint 11.50** — ADR: Gmail mimari kararı |
| `docs/DURUM.md` | Aşama 0-10 geçmiş kaydı (eski — PostgreSQL bilgisi içerir, güncel değil) |
| `docs/GELECEGIN_FIKRI_PROJE_PLANI.md` | Plan (40+ bölüm, Sprint 4 T35/T36 O-Freeze legacy backlog) |

---

## 🐛 Kritik bug-fix tarihçesi (HEAD'den geriye)

| Sprint | Commit | Kök neden | Düzeltme |
|---|---|---|---|
| **11.50** | `64bbb7a` | Dokümantasyon dağınıktı, AI oturumları sürekli yanlış bilgi okuyordu | `AGENTS.md` + `CLAUDE.md` + `HANDOVER.md` + `docs/architecture.md` + `docs/runbook.md` + ADR |
| **11.49** | `007c575` | İlkel ekleme ekranı + çift buton | Slide-in drawer modal, CSV rehber, üst +Yeni butonu kaldırıldı |
| **11.48** | `d44069f` | `MustChangePassword=true` flag | Maintenance endpoint clear-flag |
| **11.46** | `33f3055` | MFA kart hover'da yazılar görünmüyor | Hover/focus/active state'te gradient + beyaz yazı |
| **11.43** | `dab2e35` | "Şifre değişmeli" rozeti (Identity default) | Maintenance endpoint set-password-raw (raw SQL UPDATE) |
| **11.36** | `0778854` | OAuth state 3rd-party cookie engeli | `window.open` → `window.location.href` (aynı sekme, 1st-party) |
| **11.35** | `5570249` | Duplicate `/forgot-password` route shadowed `/api/auth/login` | Eski route kaldırıldı → tüm endpoint'ler canlandı |
| **11.27** | Sprint 11.27 | SPA nav Modal context'inde pushState tetiklenmiyordu | `window.location.href` (full page reload) Modal içinde |
| **10.7+** | `69b14dd` | CORS `Cors__AllowedOrigins` env yok, `UseCors` `UseAuthentication` sonrasında | Hardcoded fallback + middleware order fix |
| **10.7+** | `5decfcd` | `<Navigate>` declarative component Modal içinde çalışmıyor | `window.location.href = "/mfa-login"` |
| **10.7+** | `7a2b62e` | `document.cookie` ile HttpOnly PreMfa kontrolü sonsuz loop | Cookie kontrolü kaldırıldı, backend 200/401'e güven |
| **10.7+** | `2e08f44` | `useEffect [needsGmailOAuth]` mount-time tetikleme | Trigger on `yontemSec("Email")` user action |
| **10.7+** | `9143da9` | `providerReady` sender tipine bakıyordu (Development'a düşünce yanlış true) | Gmail-mode + RefreshToken yok check |
| **10.7+** | `800b94b` | EF Core CLI sandbox'ta migration dosya yazma sorunu | Startup idempotent raw SQL + entity class + config zaten hazır |
| **10.7** | `0412f5e` | Mail subject Türkçe mojibake | RFC 2047 `=?UTF-8?B?...?=` encoding |

**Tam commit listesi:** `git log --oneline -50`

---

## 🎯 Sprint state (HEAD: `64bbb7a`)

### Tamamlanan (Sprint 11 — Admin Panel)

- ✅ User CRUD (MinistryOfficial, ProvinceManager, ProvinceEvaluator; Student excluded)
- ✅ MFA reset / lockout temizleme
- ✅ Rol atama (atama-only, geçiş yok)
- ✅ Force password reset (mail ile link)
- ✅ Şifremi Unuttum (Yetkili + Öğrenci)
- ✅ Bulk CSV import
- ✅ Privacy guard (Student erişim yok)
- ✅ Admin Panel Frontend (3-group accordion, il alt-groups, Turkish labels, 2-column grid)
- ✅ Drawer modal for user creation (Sprint 11.49)
- ✅ CSV format rehber (Sprint 11.49)
- ✅ Sistem Admin seed — `SeedSystemAdmin__Email`/`__Password` env'i ile (boş DB'de oluşur; var olan hesaba dokunmaz)
- ✅ OAuth handshake DB-persist (Sprint 11.36)
- ✅ Maintenance endpoints: `set-password-raw`, `unlock-account`, `clear-must-change-password`, `admin-reset`
- ✅ Debug endpoints: `mail-mod`, `mail-sender`, `last-login`, `last-sifre-reset`, `cors-config`, `cors-test`

### Açık / bekleyen (Sprint 12)

- 🚧 **Per-user Gmail mimarisi** — Sprint 12'de planlanıyor (ADR 0001)
- 🚧 **Maintenance endpoint'leri production'dan kaldır** — Sprint 12 admin panel "SystemAdmin yönetimi" ile değiştir
- 🚧 **Test user account hardening** — `onur35bilisim@gmail.com` MFA setup tamamlansın
- 🚧 **i18n infrastructure** — şu an hardcoded Türkçe; Sprint 12+ sonra i18n
- 🚧 **AWS SES migration** — Gmail Test Mode 100 user limit + 7-day refresh token. Production 1000+ user için gerekli
- 🚧 **`/giris` route** — orphan `PublicLayout.tsx` ve `KullaniciCikis.tsx` dosyaları `App.tsx`'e bağlı değil. Onur istediğinde route eklenebilir
- 🚧 **Email template management** — şu an hardcoded HTML
- 🚧 **xUnit + Vitest** — Sprint 4 T35/T36 O-Freeze legacy backlog'undan
- 🚧 **Per-il şifre sıfırlama mail tracking** — şu an sadece Sistem Admin görür

### Known issues

- 🔧 **EF Core CLI sandbox sorunu** — `dotnet ef migrations add` dosya yazmıyor. Lokal geliştirici makinede CI ile çalıştır.
- 🔧 **Modal SPA nav** — `useNavigate` Modal context'inde çalışmıyor. `window.location.href` workaround.
- 🔧 **HTTPS-only cookies** — cross-origin SameSite=None; Secure zorunlu. Development'ta farklı port test'i sorunlu olabilir.
- 🔧 **`/api/__maintenance/*`** production'da — Sprint 12'de kaldırılacak, ama Sprint 11.x boyunca acil müdahale için gerekli.

---

## 🧪 Magic Context kullanımı

Bu projede Magic Context aktif. `ctx_search`, `ctx_expand`, `ctx_note`, `ctx_memory` tool'larıyla:
- Eski oturumları ara (`ctx_search` ile).
- Önemli kararları `ctx_memory`'ye yaz.
- Bekleyen işleri `ctx_note` ile not al.

**Yeni oturumda:**
1. `AGENTS.md` → `CLAUDE.md` → `HANDOVER.md` oku.
2. `ctx_search` ile eski context'i çek (örn: "login CORS", "OAuth handshake", "duplicate route").
3. Magic Context desk tagging prensibini uygula (sık stamp, nadiren genişlet).

---

## 📞 Onur'a cevap verirken

- Caveman modu ON: Türkçe ultra-terse, fragments OK, code unchanged.
- Onay kısa: "ONAYLIYORUM", "A", "devam et".
- Code/commits/PR'lar normal Türkçe.
- Internet search zorunlu her fix öncesi.
- Safety warning / irreversible action durumunda caveman otomatik düşer.

---

*Bu dosya proje kökünde. Sprint state ve açık işler için `HANDOVER.md`. Mimari için `docs/architecture.md`. Operations için `docs/runbook.md`.*
