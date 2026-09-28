# Handover — Fikir Platformu (HEAD: `007c575`)

> **Amaç:** Yeni AI oturumu açıldığında **HANDOVER + CLAUDE.md** okuyunca sprint state ve açık işler net olsun. Tüm detay için `CLAUDE.md`, mimari için `docs/architecture.md`, operasyon için `docs/runbook.md`.

---

## 📌 HEAD

- **Commit:** `007c575` (Sprint 11.49 — Admin Panel tasarım yenileme)
- **Branch:** main
- **Last deploy:** Render auto-deploy main push (~2-3 dk backend, ~1-2 dk frontend)

## 🌐 Services

| Service | URL | Tech |
|---|---|---|
| Frontend (Static Site) | `https://fikir-platformu-web.onrender.com` | React 19 + Vite 8 |
| Backend (Docker) | `https://fikir-platformu.onrender.com` | .NET 10 + EF Core 9 |
| DB (TiDB Cloud) | `gateway01.eu-central-1.prod.aws.tidbcloud.com:4000` | MySQL-compatible |

## 🧪 Test User

| Field | Value |
|---|---|
| Email | `onur35bilisim@gmail.com` |
| Password | `NewAudit456!` |
| Roles | SystemAdmin + MinistryOfficial |
| MFA | TOTP (Authenticator) |

**Sistem Admin** (alternative): `fikir.platformu.iletisim@gmail.com` / `Bilisim35sse` (nokta YOK).

## 🎯 Sprint State (HEAD: `007c575`)

### ✅ Tamamlanan — Sprint 11 (Admin Panel + Gmail DB-persist)

**Backend (Sprint 11):**
- User CRUD, MFA reset, password reset, role assignment (atama-only)
- Şifremi Unuttum (yetkili + öğrenci)
- Bulk CSV import (multipart upload)
- Privacy guard (Student rolü user'lara admin erişim yok)
- Sistem Admin seed (`fikir.platformu.iletisim@gmail.com`)
- Maintenance endpoints (`/api/__maintenance/*`, `/api/auth/__debug/*`)
- Gmail OAuth DB-persist (encrypted `GmailRefreshToken` entity)
- CORS middleware fix + default origins fallback
- Duplicate `/forgot-password` + `/reset-password` route temizliği
- Login debug state (`SifreResetDebug.SonLoginDenemesi` — captcha-basarisiz, yanlis-sifre, vs.)

**Frontend (Sprint 11):**
- Admin Panel UI (3-group accordion: Yönetim, İl AR-GE Yöneticileri, İl AR-GE Değerlendiricileri)
- 81 il alt-groups, 2-column grid
- Default KAPALI accordion, localStorage persist
- Türkçe label'lar (rolAdi() helper), Identity DB adları korundu
- Drawer modal for user creation (Sprint 11.49)
- CSV format rehber (Sprint 11.49)
- MFA setup/login kart stilleri (koyu yazı fix, hover state)

**Kararlar:**
- Sistem sabit Gmail mimarisi (ADR 0001, Sprint 12'de per-user'a geçiş)
- KVKK retention: 4+ yıl önce login olan Student'lar yıllık job ile silinir
- Pasif hesap kilitleme: tamamen kaldırıldı (Sprint 11.29)

### 🚧 Açık işler (Sprint 12 backlog)

- **Per-user Gmail mimarisi** (ADR 0001 Sprint 12 planı)
- **Maintenance endpoint'leri production'dan kaldır** — Sprint 12 admin panel "SystemAdmin yönetimi" ile değiştir
- **AWS SES migration** — Gmail Test Mode 100 user limit + 7-day refresh token. Production 1000+ user için gerekli
- **`/giris` route** — orphan `PublicLayout.tsx` ve `KullaniciCikis.tsx` dosyaları `App.tsx`'e bağlı değil. Onur istediğinde route eklenebilir
- **Email template management** — şu an hardcoded HTML
- **i18n infrastructure** — şu an hardcoded Türkçe
- **xUnit + Vitest** — Sprint 4 T35/T36 O-Freeze legacy backlog'undan
- **Production domain** (`fikrimnet.gov.tr`) — Sprint 13+

### 🔧 Known issues

- **EF Core CLI sandbox sorunu** — `dotnet ef migrations add` dosya yazmıyor. Lokal geliştirici makinede CI ile çalıştır.
- **Modal SPA nav bug** — `useNavigate()` Modal context'inde çalışmıyor. `window.location.href` workaround.
- **Gmail Test Mode refresh token 7 gün** — Sprint 12'de per-user OAuth handshake tekrarı gerekebilir.

## ⚡ Hızlı referans

### Env (public — repo'da görünebilir)

```
Mail__Type=gmail
Mail__Gmail__ClientId=243209544707-o5709qiuebe5a9b8lbe47el1kuh9v75o.apps.googleusercontent.com
Mail__Gmail__RedirectUri=https://fikir-platformu.onrender.com/api/auth/gmail-oauth/callback
Mail__Gmail__SenderName=Geleceğin Fikri
Mail__Gmail__SenderAddress=fikir.platformu.iletisim@gmail.com
Frontend__BaseUrl=https://fikir-platformu-web.onrender.com
Cors__AllowedOrigins=https://fikir-platformu-web.onrender.com,http://localhost:5173,http://localhost:5174
AdminMaintenance__Secret=BekleyinSprint12
```

### Env (SECRET — repo'da ASLA)

- `Mail__Gmail__ClientSecret` — Google Cloud Console
- ~~`Mail__Gmail__RefreshToken`~~ — **DB'de persist** (`gmail_refresh_tokens.Id=1`), env'den silindi.

### Maintenance endpoints

| Endpoint | Amaç |
|---|---|
| `POST /api/__maintenance/unlock-account?token=...&email=...` | Identity lockout temizle |
| `POST /api/__maintenance/set-password-raw?token=...&email=...&password=...` | PasswordHash direkt set |
| `POST /api/__maintenance/clear-must-change-password?token=...&email=...` | MustChangePassword flag kapat |
| `POST /api/__maintenance/admin-reset?token=...` | Sistem Admin hesabı yeniden oluştur |
| `GET /api/auth/__debug/last-login?token=...` | Son login denemesinin detayı |
| `GET /api/auth/__debug/mail-sender?token=...` | Gmail sender bilgisi |

Token default: `BekleyinSprint12` (Sprint 12'de admin panel'den yönetilecek).

### Kullanıcı iletişim tarzı

- **Caveman modu ON** — Türkçe ultra-terse
- **Onay kısa:** "ONAYLIYORUM", "A", "devam et"
- **İnternet search zorunlu** her fix öncesi
- **Git commit + push** her önemli değişiklik sonrası

## 📜 Son commit'ler (HEAD'den geriye 10)

```
007c575 Sprint 11.49: Admin Panel tasarim yenileme - drawer modal + CSV rehber
d44069f Sprint 11.48: MustChangePassword kapatma maintenance endpoint
327c231 Sprint 11.47: MFA kart hover/focus/active state yazi fix
33f3055 Sprint 11.46: MFA setup kart beyaz yazi fix
1ae6e79 Sprint 11.45: MFA setup koyu arkaplan koyu yazi fix
```

## 🚀 Yeni oturumda ilk iş

1. **`AGENTS.md`** → **`CLAUDE.md`** → **`HANDOVER.md`** oku (bu dosya).
2. **`docs/architecture.md`** — mimari detay.
3. **`docs/runbook.md`** — operasyon + maintenance.
4. **`docs/adr/`** — önemli kararlar.
5. Onur'a: "okudum, sıradaki görev ne?"

---

*Bu dosya sprint state + açık işler içindir. Mimari ve operasyon detayları için `CLAUDE.md` + `docs/`.*
