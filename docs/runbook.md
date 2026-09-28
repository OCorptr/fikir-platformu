# Operations Runbook — Fikir Platformu

> Operasyonel rehber. Maintenance endpoint'leri, OAuth setup, deployment, troubleshooting.
> Mimari için `docs/architecture.md`. Genel context için `AGENTS.md` + `CLAUDE.md`.

---

## 🚨 Acil müdahale

### Backend down / 503

```bash
# Health check
curl https://fikir-platformu.onrender.com/api/health
# Beklenen: {"status":"healthy","application":"Geleceğin Fikri API","utcTime":"..."}

# 503/Bad Gateway ise → Render dashboard Logs kontrol
# Son deploy sonrası backend crash olmuş olabilir (örn: EF migration crash)
```

### Hesap kilitli (5 başarısız deneme → lockout)

```bash
# Identity AccessFailedCount-based lockout temizle
curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/unlock-account?token=BekleyinSprint12&email=USER@EMAIL.com"
# Beklenen: {"message":"Hesap kilidi kaldırıldı.","oncekiBasarisizDeneme":N,"yeniAccessFailedCount":0}
```

### Şifre yanlış / PasswordHash bozuk

```bash
# Identity validator bypass ile direkt PasswordHash set et
curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/set-password-raw?token=BekleyinSprint12&email=USER@EMAIL.com&password=NEW_PASSWORD"
# Beklenen: {"message":"Raw SQL PasswordHash set edildi.","verifyResult":"Success","yeniHashLen":84}
```

### Sistem Admin hesabı oluştur / şifre reset

```bash
# Mevcut hesabı sil + CreateAsync ile yeniden oluştur
curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/admin-reset?token=BekleyinSprint12"
# Beklenen: {"message":"Sistem Admin oluşturuldu.","email":"fikir.platformu.iletisim@gmail.com"}
```

### MustChangePassword flag kapat

```bash
# Identity default olarak CreateAsync sonrası true set edebiliyor
curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/clear-must-change-password?token=BekleyinSprint12&email=USER@EMAIL.com"
# Beklenen: {"message":"MustChangePassword kapatıldı.","oncekiDeger":true,"yeniDeger":false}
```

---

## 🔧 Maintenance endpoints

**Güvenlik:** Tüm `/api/__maintenance/*` ve `/api/auth/__debug/*` endpoint'leri `?token=BekleyinSprint12` query string token kontrolü yapar. `AdminMaintenance__Secret` env ile override edilebilir.

> ⚠️ **Sprint 12'de kaldırılacak.** Production'da kalıcı bırakılmamalı. Acil durumlar için.

| Endpoint | Method | Amaç |
|---|---|---|
| `/api/__maintenance/unlock-account` | POST | Identity lockout temizle |
| `/api/__maintenance/set-password` | POST | PasswordHash direkt set (UserManager.UpdateAsync) |
| `/api/__maintenance/set-password-raw` | POST | PasswordHash direkt set (raw SQL UPDATE) |
| `/api/__maintenance/clear-must-change-password` | POST | MustChangePassword flag kapat |
| `/api/__maintenance/admin-reset` | POST | Sistem Admin hesabı yeniden oluştur |
| `/api/auth/__debug/cors-config` | GET | Aktif CORS policy |
| `/api/auth/__debug/cors-test` | GET | OPTIONS preflight test |
| `/api/auth/__debug/mail-mod` | GET | Aktif email sender modu |
| `/api/auth/__debug/mail-sender` | GET | Sistem sabit Gmail bilgisi |
| `/api/auth/__debug/last-login` | GET | Son login denemesinin detayı |
| `/api/__debug/last-sifre-reset` | GET | Son şifre sıfırlama denemesinin detayı |

---

## 🔐 Gmail OAuth Handshake

### İlk kurulum (veya token expire olmuşsa)

**Amaç:** `Mail__Gmail__RefreshToken` DB'ye kaydedildi (Sprint 11.36+). `Mail__Gmail__ClientSecret` zaten Render env'de.

**Adımlar:**

1. Sistem Admin ile `/admin/oauth` sayfasına git (`onur35bilisim@gmail.com`).
2. **"Gmail OAuth Handshake'i Başlat"** butonuna tıkla.
3. **Aynı sekmede** Google OAuth'a yönlendirilirsin (3rd-party cookie engeli nedeniyle).
4. Google'da `fikir.platformu.iletisim@gmail.com` ile login ol.
5. Consent → **"İzin ver"**.
6. Callback → `/admin/oauth?gmail_oauth=ok` → ✓ mesajı.

**Doğrulama:**

```bash
curl "https://fikir-platformu.onrender.com/api/auth/__debug/mail-sender?token=BekleyinSprint12"
# Beklenen:
# {
#   "senderAddress": "fikir.platformu.iletisim@gmail.com",
#   "envRefreshTokenVar": false,
#   "dbRefreshTokenVar": true,
#   "dbTokenUpdatedAt": "2026-09-28T01:59:21",
#   "beklenenAdres": "fikir.platformu.iletisim@gmail.com"
# }
```

**Token expire olursa:** OAuth handshake'i tekrarla. Google Test Mode refresh token 7 gün, Production domain verification sonrası 6 ay.

### Mail gönderim testi

```bash
# Admin Panel'den herhangi bir kullanıcıya "Şifre Sıfırla" tetikle
# Gelen mail'in göndereni: fikir.platformu.iletisim@gmail.com
# Türkçe karakterler doğru görünmeli (RFC 2047 encoded-word)
```

### Mail gelmiyorsa

```bash
# 1. Mail mod kontrol
curl "https://fikir-platformu.onrender.com/api/auth/__debug/mail-mod?token=BekleyinSprint12"
# Beklenen: {"mailTypeEnv":"gmail","aktifSender":"GmailApiEmailSender",...}

# 2. Mail sender kontrol
curl "https://fikir-platformu.onrender.com/api/auth/__debug/mail-sender?token=BekleyinSprint12"
# dbRefreshTokenVar:false ise OAuth handshake gerekli

# 3. OAuth handshake sonrası tekrar test
```

---

## 🚀 Deployment

### Git → Render auto-deploy

```bash
# Normal akış
git add -A
git -c user.name=OnurCorptr -c user.email=onur35bilisim@gmail.com commit -m "Sprint X.Y: kısa açıklama"
git push origin main
# → Render otomatik build + deploy (~2-3 dk backend, ~1-2 dk frontend)
```

### Manuel deploy (acil)

Render dashboard → Service → "Manual Deploy" → "Deploy latest commit".

### Bundle hash doğrulama

```bash
# Frontend bundle adı
curl -sI "https://fikir-platformu-web.onrender.com/" | grep -i "etag\|last-modified"
# Veya
curl "https://fikir-platformu-web.onrender.com/assets/" 2>/dev/null | head -5
# Static Site index.html dist/index.html'den gelir; bundle index-<hash>.js
```

### Yeni env değişkeni

Render dashboard → Service → Environment → "Add Environment Variable". `KEY=VALUE`. Auto-restart.

---

## 🐛 Troubleshooting

### "İstek başarısız (HTTP 400)"

Frontend generic fallback — backend response'u parse edilmiyor.

```bash
# Login hatası detay
curl "https://fikir-platformu.onrender.com/api/auth/__debug/last-login?token=BekleyinSprint12"
# {"denemeVar":true,"deneme":{"captchaGecti":true,"userBulundu":true,"sifreDogrulandi":false,...,"sonuc":"yanlis-sifre"}}
```

**Olası sonuçlar:**
- `captcha-basarisiz` — Captcha expired (5dk) veya yanlış çözüldü.
- `email-bulunamadi` — E-posta kayıtlı değil.
- `kilitli` — Hesap lockout. Maintenance endpoint ile aç.
- `email-dogrulanmamis` — `EmailConfirmed=false` (Identity default).
- `yanlis-sifre` — Şifre yanlış veya PasswordHash bozuk. Maintenance endpoint ile set et.
- `rol-uyumsuz` — Hesap bu giriş tipi için yetkili değil.
- `basarili` — Login başarılı, MFA gelmeli.

### CORS hatası

```bash
# CORS config doğrula
curl "https://fikir-platformu.onrender.com/api/auth/__debug/cors-config?token=BekleyinSprint12"
# {"corsOrigins":["https://fikir-platformu-web.onrender.com",...],...}

# OPTIONS preflight test
curl -X OPTIONS "https://fikir-platformu.onrender.com/api/auth/login" \
  -H "Origin: https://fikir-platformu-web.onrender.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -I
# Beklenen: 204 + Access-Control-Allow-Origin: https://fikir-platformu-web.onrender.com
```

**Çözüm:** Render env'de `Cors__AllowedOrigins=https://fikir-platformu-web.onrender.com,http://localhost:5173` ekle. Veya hardcoded fallback zaten var (Sprint 10.7+).

### OAuth handshake fail

**Symptom:** `/admin/oauth` callback'inde "state uyumsuz — CSRF koruması".

**Cause:** Browser 3rd-party cookie engellemiş olabilir. `window.open` ile yeni sekmede OAuth handshake yapma.

**Fix:** `services/api.ts` `oauthStartUrl()` helper'ı `window.location.href` kullanır (Sprint 11.36). Hard refresh sonrası tekrar dene.

### Backend crash (Bad Gateway)

```bash
# Render dashboard → Logs
# [SIFRE-RESET] [LOGIN] [MAINT] etiketli loglar
# NullReferenceException, DbUpdateException, vb.

# Geçici çözüm: Manuel deploy eski bir commit'e rollback
# Render → Service → Manual Deploy → eski commit SHA
```

### Frontend bundle eski yüklü

```bash
# Hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# Veya DevTools → Application → Clear Storage → Clear site data
```

### DB migration sorunu

```bash
# Backend log kontrol
# "Database.Migrate() failed: ..." veya EF CLI dosya yazma sorunu
# Geçici çözüm: Sprint 11+ raw SQL idempotent CREATE TABLE IF NOT EXISTS
# Yeni migration gerekirse lokal geliştirici makinede:
dotnet ef migrations add SprintName
# Sandbox'ta dosya yazma sorunu olduğu için çalışmıyor.
```

---

## 📊 Health check pattern

```bash
# Backend health
curl https://fikir-platformu.onrender.com/api/health
# {"status":"healthy","application":"Geleceğin Fikri API","utcTime":"2026-09-28T..."}

# DB health
curl https://fikir-platformu.onrender.com/api/health/db
# {"status":"healthy","database":"connected",...}

# CORS preflight
curl -X OPTIONS "https://fikir-platformu.onrender.com/api/auth/login" \
  -H "Origin: https://fikir-platformu-web.onrender.com" \
  -H "Access-Control-Request-Method: POST" \
  -I
```

---

## 🔐 Güvenlik checklist

- [ ] `Mail__Gmail__ClientSecret` Render env'de, repo'da DEĞİL.
- [ ] `Mail__Gmail__RefreshToken` DB'de encrypted (Sprint 11.36+), env'de DEĞİL.
- [ ] `AdminMaintenance__Secret` strong random, default `BekleyinSprint12` (geçici).
- [ ] CORS whitelist sadece gerekli origin'ler (production + dev).
- [ ] HTTPS-only cookies (`SameSite=None; Secure`).
- [ ] `/api/__maintenance/*` Sprint 12'de kaldırılacak.
- [ ] `KeyVault` veya `Render Secret Files` kullan (env'de plaintext secret azalt).

---

*Bu dosya operasyonel. Mimari için `docs/architecture.md`. Genel context için `AGENTS.md` + `CLAUDE.md`.*
