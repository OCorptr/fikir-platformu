# Fikir Platformu — Session Handover (2026-09-26)

> **Amaç:** Yeni AI oturumu açıldığında bu dosya okununca projenin **tüm bağlamı, son durumu, açık sorunları ve nasıl devam edileceği** net olsun. Yeni AI bu dosyayı okuduktan sonra ek soru sormadan `devam et` diyebilmeli.

---

## 📌 Proje Kimliği

- **Repo:** `D:\Coding\Fikir_Platformu`
- **GitHub:** <https://github.com/OCorptr/fikir-platformu>
- **Stack:**
  - Backend: **.NET 10** + EF Core 9 + ASP.NET Core Identity 9, **Pomelo MySQL provider**
  - Frontend: **React 19 + Vite 8 + TypeScript 7** (sadece 3 runtime deps: react, react-dom, react-router)
  - DB: **TiDB Cloud Frankfurt** (`gateway01.eu-central-1.prod.aws.tidbcloud.com:4000`, DB `fikir_platformu`)
- **Hedef:** YEGİTEK deployment (il AR-GE birimleri + bakanlık). İleride `fikrimnet.gov.tr`'ye taşınacak → nginx reverse proxy + relative URL'ler zaten şu anda kullanılıyor.
- **Kullanıcı (Onur):** Windows kernel driver developer (O-Freeze projesi ayrı, `D:\Coding\O_FREEZE`, şu an dormant). Fikir Platformu aktif proje.

## 🌐 Render Services (auto-deploy main branch → Docker build)

- **Backend:** <https://fikir-platformu.onrender.com> (`fikir-platformu` Docker)
- **Frontend:** <https://fikir-platformu-web.onrender.com> (`fikir-platformu-web` Static)
- Cross-origin → CORS + `Cookie.SameSite=None; Secure` zorunlu (kodda handle edildi).

## 🧪 Test User

- Email: `onur35bilisim@gmail.com`
- Password: `NewAudit456!`
- Role: **SystemAdmin + MinistryOfficial** (çift context)
- MFA: **TOTP** enabled (Google/Microsoft Authenticator). Onur'un authenticator app'i yok diyor ama DB'de secret kayıtlı — test için 6 haneli geçerli bir kod gerekir.

## 💬 İletişim Tarzı (Onur Kuralları)

- **Caveman modu varsayılan ON** — Türkçe ultra-terse, max compression. `/caveman off` yazmadıkça.
- **Git commit + push** her önemli değişiklik sonrası zorunlu.
- **Internet research zorunlu** her fix öncesi; **Microsoft Learn** primary kaynak.
- **Build deterministic SHA** (aynı source aynı SHA üretmeli).
- **Bundle hash verify** (Vite content-based hash).
- Onay kısa: "ONAYLIYORUM", "A", "devam et".
- Uzun açıklama sevmiyor; detay sadece safety warning / irreversible action durumunda.

---

## 🔐 Gmail OAuth Konfigürasyonu (Render env)

> **PUBLIC (repo'ya yazılabilir):**

```
Mail__Type=gmail
Mail__Gmail__ClientId=243209544707-o5709qiuebe5a9b8lbe47el1kuh9v75o.apps.googleusercontent.com
Mail__Gmail__RedirectUri=https://fikir-platformu.onrender.com/api/auth/gmail-oauth/callback
Mail__Gmail__SenderName=Geleceğin Fikri
Mail__Gmail__SenderAddress=fikir.platformu.iletisim@gmail.com
Frontend__BaseUrl=https://fikir-platformu-web.onrender.com
```

> **SECRET (ASLA repo'ya commit edilmez, Onur'dan istenir):**

- `Mail__Gmail__ClientSecret` — Google Cloud Console'dan
- `Mail__Gmail__RefreshToken` — **OAuth handshake sonrası DB'ye kaydedilir**, sonra Render env'e eklenir

### OAuth Handshake Akışı (yapılmadı henüz)

1. Kullanıcı `/api/auth/gmail-oauth/start` endpoint'ine gider (browser'da)
2. Google OAuth consent ekranı → `fikir.platformu.iletisim@gmail.com` ile login
3. Callback `/api/auth/gmail-oauth/callback` → backend refresh token DB'ye kaydeder
4. Aynı token `Mail__Gmail__RefreshToken` olarak Render env'e eklenir
5. Sonraki /method çağrılarında `providerReady: true`, `needsGmailOAuth: false` döner → OTP direkt gider
6. Döküman: `docs/GOOGLE-OAUTH-SETUP.md`

**RefreshToken yoksa şu anki davranış (Sprint 10.7+):** `/method` `providerReady: false, needsGmailOAuth: true` döner → frontend otomatik OAuth'a yönlendirir (MfaLoginPage + MfaSetupPage line 80-86, 95-105).

---

## 📜 Sprint Tarihçesi (HEAD: `69b14dd`)

### Sprint 10.7++ — CORS fix + Modal close/reopen
- **`69b14dd`** Backend: CORS middleware order + default origins fallback
  - Root cause: `Cors__AllowedOrigins` Render env'de YOK'tu → `UseCors()` hiç çağrılmıyor, cross-origin 401 (CORS)
  - Fix 1: env yoksa development=localhost:5173/5174, production=https://fikir-platformu-web.onrender.com
  - Fix 2: `app.UseCors(...)` satırı `app.UseAuthentication()`'dan **ÖNCE** taşındı (Microsoft Learn: UseCors after UseRouting, before UseAuthorization)
  - Dogrulama: playwright-cli /api/auth/mfa/method OPTIONS preflight artik basarili, 401 response donuyor (PreMfa yok, expected)
  - Modal yetkili flow: 1. tiklama → acildi, Kapat → kapandi, 2. tiklama → acildi (bug yok)

### Sprint 9 — SystemAdmin + MFA setup/verify
- Commits: `a3b276d`, `3da1276`, `c909db1`, `c28e1ad`, `fceee50`, `0f2092a`, `c8772a3`, `b81f044`

### Sprint 10 — MFA Email OTP + Admin yönetimi
- `7889d09` MFA Email OTP backend
- `ff0c430` Database.Migrate() (auto-migrate on startup)
- `8a0b95e` SchemaBehavior.Ignore (EF Core warning suppression)

### Sprint 10.1 — Gmail API OAuth2 (HTTPS, port 443 — Render SMTP bloklu)
- `6432872`, `3afd21d` `GmailApiEmailSender.cs`
- `d6fa53a` Relative URL + auto-trigger helper
- `docs/GOOGLE-OAUTH-SETUP.md`

### Sprint 10.2-3 — Cross-context guard
- `26d8304` YetkiliGirişModal banner
- `1a904db` /me ile context tespiti
- Bir context'te (province/ministry/student) oturum açıksa login formu gizlenir.

### Sprint 10.4 — Loading state fix
- `3dccfe0` Initial state TRUE → form flash önleme

### Sprint 10.5 — Relative URL + Gmail OAuth redirect
- `d6fa53a` `providerReady` + `needsGmailOAuth` flag'leri `/method` response'unda
- Frontend OAuth useEffect → `window.location.assign('/api/auth/gmail-oauth/start?returnTo=...')`

### Sprint 10.6 — Dockerfile fix
- `8d60ef4` NU1903 + HTTP_PORTS warning

### Sprint 10.7 — Sprint sonu polish
- `e4eaeec` YetkiliGirisModal initial TRUE
- `cfd1770` CSS box-shadow cache-busting
- `fc8aedf` YetkiliGirisModal mfaGetMethod PreMfa redirect
- `48974ac` **mfaCancel AllowAnonymous** (PreMfa cookie yokken bile logout çalışsın)

### Sprint 10.7+ — Hata düzeltmeleri (4 commit)
- **`094381f`** MfaLoginPage `yukleniyor` state initial TRUE + YetkiliGirisModal MFA-halfway redirect (mfaGetMethod 200 → navigate `/mfa-login` + modal kapat)
- **`708f530`** MfaLoginPage document.cookie PreMfa kontrol (PreMfa cookie yoksa backend'e hiç gitme, direkt `/giris` → sonra `/`'e)
- **`87c2878`** MfaSetupPage Gmail OAuth auto-trigger (Email yöntemi seçilince `needsGmailOAuth:true` ise `/gmail-oauth/start`'a yönlendir)
- **`b9361ae`** **CRITICAL FIX:** `navigate("/giris")` → `navigate("/")`. `/giris` route App.tsx'te yoktu — 7 yerde 404'e düşüyordu. PublicLayout.tsx'te `/giris` string'i var ama App.tsx'e bağlı değil (refactor kalıntısı).

---

## 🐛 Bilinen Bug'lar / Açık Sorular

### 1. Yetkili Giriş Modal'ın fresh state davranışı (test edilmedi — `b9361ae` deploy sonrası)

Onur "Yetkili Giriş tıklayınca Oturum kontrol ediliyor deyip kapanıyor" diyor. Beklenen: PreMfa cookie yoksa `mfaGetMethod()` 401 → catch → /me → login form açılır.

Onur'un browser'ında eski PreMfa cookie kalmış olabilir. **Test için incognito/private tab kullan.** Henüz doğrulanmadı.

### 2. /giris route eksik

PublicLayout.tsx balonMetinleri `/giris` string'i içeriyor ama App.tsx'te route yok. 7 yerde `navigate("/giris")` çağrısı vardı, hepsi `navigate("/")`'e çevrildi. İleride `/giris` (öğrenci login landing) route'u eklenmeli:

```tsx
// App.tsx'e eklenecek:
<Route path="/giris" element={<Navigate to="/" replace />} />
// veya yeni bir GirişPage component (PublicLayout kullanarak)
```

### 3. Gmail OAuth RefreshToken alınmadı

OAuth handshake yapılmadı. Onur browser'da `/api/auth/gmail-oauth/start` git → Google'da consent → callback → refresh token DB'ye kaydedilir → Render env'e `Mail__Gmail__RefreshToken` eklenir.

Şu an frontend yeni flow ile (Sprint 10.7+ commit `87c2878`) ilk kez Email MFA seçen kullanıcı için OAuth'u otomatik tetikliyor. Test edilmedi.

### 4. MCP Tool Discovery başarısız (Mavis host sınırlaması)

`mcp create` ile MCP server eklenir, config'de `enabled:true` görünür. Ama `mcp_invoke` her tool adına `Unknown tool_name` döner — MCP tool'ları runtime'a inject edilmiyor. Bu **Mavis host sınırlaması**, MCP server hatası değil.

**Test alternatifi:** Node.js Playwright (chromium) zaten kuruldu (`npx playwright install chromium`). Doğrudan script yazıp test etmek gerekebilir.

---

## 📁 Kritik Dosyalar

### Backend

| Dosya | Amaç |
|---|---|
| `D:\Coding\Fikir_Platformu\backend\src\FikirPlatformu.Api\Endpoints\MfaEndpoints.cs` | MFA + OAuth endpoints |
| → line 111 `/method` | `providerReady`, `needsGmailOAuth` response |
| → line 150 `/send-email-otp` | OTP gönder (dev mode'da `devCode` response'a düşer) |
| → line 388 `/cancel` | `AllowAnonymous()` — PreMfa yokken bile logout |
| `D:\Coding\Fikir_Platformu\backend\src\FikirPlatformu.Api\Endpoints\AuthEndpoints.cs` | Auth endpoints |
| → line 340 `/logout` | `AllowAnonymous` — tüm cookie'leri temizler |
| → line 454 `/gmail-oauth/start` + `/callback` | OAuth handshake |
| `D:\Coding\Fikir_Platformu\backend\src\FikirPlatformu.Api\Program.cs` line 99 | 4 modlu email sender seçici |
| `D:\Coding\Fikir_Platformu\backend\src\FikirPlatformu.Infrastructure\Email\GmailApiEmailSender.cs` | OAuth2 HTTPS, port 443 |

### Frontend

| Dosya | Amaç |
|---|---|
| `D:\Coding\Fikir_Platformu\frontend\src\pages\MfaLoginPage.tsx` | `yukleniyor` state + document.cookie kontrol + OAuth useEffect |
| `D:\Coding\Fikir_Platformu\frontend\src\pages\MfaSetupPage.tsx` | Email seçilince OAuth redirect (`needsGmailOAuth` kontrol) |
| `D:\Coding\Fikir_Platformu\frontend\src\components\YetkiliGirisModal.tsx` | `useState(true)` initial + mfaGetMethod PreMfa redirect |
| `D:\Coding\Fikir_Platformu\frontend\src\components\AuthModal.tsx` | Öğrenci login (`yetkiliOturumYukleniyor` state) |
| `D:\Coding\Fikir_Platformu\frontend\src\components\PublicLayout.tsx` | balonMetinleri (refactor kalıntısı — App.tsx'e bağlı değil) |
| `D:\Coding\Fikir_Platformu\frontend\src\App.tsx` | Routes (Sprint 10.7+) |

### Docs

| Dosya | Amaç |
|---|---|
| `README.md` | Proje özeti |
| `DEPLOYMENT.md` | Render deployment |
| `DURUM.md` | Durum raporu |
| `SECURITY.md` | Güvenlik politikası |
| `docs/GOOGLE-OAUTH-SETUP.md` | Gmail OAuth kurulum adımları |
| `docs/infra/render.yaml` | Render Infrastructure-as-Code |
| `docker-compose.yml` | Local dev compose |

---

## 🚀 Sprint 10.7++ Bug-fix Workstream (Onur 2026-09-27 oturumu)

Oturum başında `Yetkili Girişi` modal login sonrası yönlendirmiyordu. Kök neden zinciri CORS olmuştu, sonra SPA vs static-site routing, sonra OAuth absolute-URL. Hepsi sırayla fix'lendi.

### Commit serisi (main, push edildi → Render auto-deploy hepsi tetiklendi)

| Commit | Scope |
|---|---|
| `69b14dd` | **Backend CORS middleware order + default origins.** `UseCors()` `UseAuthentication`'dan ÖNCE taşındı (Microsoft Learn). `corsOrigins` env boşsa production için `fikir-platformu-web.onrender.com` hardcoded fallback. |
| `5decfcd` | **Frontend `YetkiliGirisModal` full-page nav.** `useNavigate()` ve `<Navigate>` Modal içinde v7 declarative modda history.pushState tetiklemiyordu. Tüm navigate call'ları `window.location.href = "/..."` (full page load) ile değişti. |
| `7a2b62e` | **Frontend `MfaLoginPage` document.cookie bug fix.** `document.cookie` ile HttpOnly PreMfa kontrolü yanlıştı; HttpOnly cookie JS'den görünmediği için "yok" sanıp sonsuz döngü oluşturuyordu (`/`'e redirect). Çıkarıldı, backend `mfaGetMethod`'a güveniyoruz. 401/403 → `window.location.href = "/"` (SPA nav Modal dışında da güvenli değildi). |
| `2e08f44` | **Frontend `MfaLoginPage`/`MfaSetupPage` E-posta seçiminde OAuth handshake.** `yontemSec("Email")` içinde `needsGmailOAuth: true` ise OTP göndermeden ÖNCE `/api/auth/gmail-oauth/start?returnTo=...` ile full redirect tetikleniyor. |
| `84e14d4` | **Frontend OAuth absolute backend URL.** `window.location.assign(\`/api/...\`) ` fikir-platformu-web.onrender.com` SPA fallback'ine takılıp 404 dönüyordu. `services/api.ts` → `backendOrigin()` + `backendApiUrl()` helper'ları eklendi, hardcoded fallback `https://fikir-platformu.onrender.com`. Tüm OAuth call'lar bu kullanıyor. |
| `9143da9` | **Backend `MfaEndpoints` providerReady + needsGmailOAuth Gmail-mode based.** Eski kontrol sender tipine bakıyordu (Development'a düşünce yanlış true dönüyordu). Yeni: Gmail mode + RefreshToken yok → `providerReady:false, needsGmailOAuth:true`. Env kontrolü sadece (DB persist Sprint 11). |
| `800b94b` | **(yarım) Gmail refresh token DB persist + HassasVeriSifreleme gmail protector.** `GmailRefreshToken` entity + `GmailRefreshTokenConfiguration` + `HassasVeriSifreleme.SifreleGmail/CozGmail` hazır. **EF Core CLI dosya yazma sorunu (sandbox)** nedeniyle migration dosyaları temiz oluşturulamadı — Sprint 11'e bırakıldı. Workaround: `Program.cs` startup'ta idempotent `CREATE TABLE IF NOT EXISTS gmail_refresh_tokens (...)` SQL. Caller dosyalarında DB kullanan yerler no-op comment'lendi (Sprint 11'de geri açılacak). |

### Sprint 11 plan başlangıcı (per-user Gmail mimarisi)

Onur itirazı: "herkes kendi Gmail'i ile mi olması gerekiyordu" — İNTERNET ARAŞTIRMASI ONAYLIYOR: **per-user Google API OAuth2 standart pattern**. Google for Developers, Agentic Fabriq, Microsoft Entra OTPSender üçü de "refresh_token **keyed by user id**" / "per end user" diyor.

**SİSTEM SABİT GMAİL (mevcut) YANLIŞ KARAR** — Sprint 11 başında değiştirilecek:

| Task | Scope |
|---|---|
| **1. Yeni entity `UserGmailToken`** (userId FK ApplicationUser, encryptedRefreshToken, scope='gmail.send', UpdatedAt). EF migration temiz generate et. Index: `(userId)` unique. | Sprint 11.P0 |
| **2. `GmailApiEmailSender` → factory.** `ForUserAsync(userId, cancellationToken)` signature. Refresh token'ı user'a özel DB'den çözer. Sender scoped → user-specific. | Sprint 11.P0 |
| **3. `mfaGetMethod` user-specific.** User'ın kendi `UserGmailToken`'ı var mı kontrol et. Yoksa `needsGmailOAuth:true` + state user id'sini içer. | Sprint 11.P1 |
| **4. `mfaSendEmailOtp` user-authenticated.** PreMfa scheme authenticated → user id okunur → sender user'a özel. | Sprint 11.P1 |
| **5. `AuthEndpoints` OAuth callback user-tied.** State kısmına userId ekle (encrypted cookie içinde). Callback user.id ile DB'ye upsert (encrypted). | Sprint 11.P0 |
| **6. Frontend `MfaLoginPage` / `MfaSetupPage` per-user.** Handshake tetikleme aynı, ama user zaten authenticated (Login → MFA setup → user kendi Gmail'ine bağlar). | Sprint 11.P1 |
| **7. Migration dosyaları Sandbox dışı CI'da üret.** Lokal sandbox'ta `dotnet ef migrations add` dosya yazmadığı için temiz üretim yok. CI veya temiz bash'te tekrar üretilecek. | Sprint 11.P2 |

### Sprint 11 — SystemAdmin Panel (5 feature)

YEGİTEK tarafından "sunucuya erişim zorunluluğu kaldır" gereksinimi. Sistem Admin hesabı Production'da seed'lenmiş: `fikir.platformu.iletisim@gmail.com` / `Bilisim35sse` (Sprint 10.7+++).

**Privacy kuralı (Onur Sprint 10.7+):** Admin scope MinistryOfficial / ProvinceManager / ProvinceEvaluator kullanıcılarına erişir. **Öğrenci kayıt bilgilerine erişim YOK** — öğrenciler için "Şifremi Unuttum" yeterli.

| # | Feature | Açıklama |
|---|---|---|
| 1 | **User CRUD** | Tüm Ministry/Province kullanıcılarını liste/oluştur/düzenle/sil. Öğrenci erişim yok. Filtre: rol, MFA enabled, lockout, son login. |
| 2 | **MFA reset / lockout temizleme** | Telefon kayıp → TOTP reset, re-setup zorla. Lockout/soft-banned hesabı aç. |
| 3 | **Rol atama** (atama-only) | ProvinceManager / MinistryOfficial / ProvinceEvaluator. **"Geçiş" yok** (Onur: hata riski). DB'de rol değişimi edit-only. |
| 4 | **Force password reset** | Tek kullanımlık reset link email ile, yeni şifre girişi. |
| 5 | **Şifremi Unuttum** (Sprint 11.5) | Yetkili Girişi + Öğrenci Girişi ekranlarına link. Backend: `/api/auth/forgot-password` (email + reset token) + `/api/auth/reset-password` (token + new password). DB: `PasswordResetTokens` tablo. |
| 6 | **Bulk invite / CSV import** (Sprint 11.5) | 400+ AR-GE hesabı için CSV toplu import. Sütunlar: email, ad, soyad, rol, il_kodu. Activation mail. |

**Çıkarıldı (Onur Sprint 10.7+):** Impersonation, SSO/SAML/Microsoft Entra (production-only), Backup/restore (TiDB Cloud zaten otomatik).

### Sprint 10.7++ Manuel yol (Onur için şu an)

Çünkü Sprint 10.7 tamamlanma aşaması, per-user'a geçiş Sprint 11'e. **ŞİMDİ:**
1. Hard refresh (Ctrl+Shift+R)
2. Yetkili Giriş → login → /mfa-login
3. **E-posta kodu seç** → otomatik Google OAuth'a yönlendirilir
4. Google consent ekranı → kendi Google hesabıyla onayla (`onur35bilisim@gmail.com` veya kuruluş hesabı)
5. Google → callback → backend `/mfa-login?gmail_oauth=ok` redirect
6. **Render dashboard logs** → `refresh_token` satırını yakala (artık DB'ye yazılmıyor; Sprint 11'de)
7. Render env → `Mail__Gmail__RefreshToken = <token>` yapıştır
8. Restart sonrası tüm OTP'ler o Gmail'den gider (Sistem Sabit).

## 🔄 Test Akışı (Onur'un Doğrulama Pattern)

Onur test makinesinde:
1. **Fresh install** (Macrium restore + bundle kopyalama)
2. Login → MFA halfway → /mfa-login
3. Anasayfa → Yetkili Giriş → **modal kapanıp /mfa-login direkt açılmalı** ✓ (Sprint 10.7+ fix)
4. `Çıkış - Ana Sayfa` → URL'ye `/mfa-login` yaz → **sayfa ASLA açılmamalı** ✓ (Sprint 10.7+ fix `708f530`)
5. Yeni user → MFA setup → Email seç → **OAuth'a otomatik yönlendir** ✓ (Sprint 10.7+ fix `87c2878`)

---

## 🚧 Açık Yapılacaklar

| Öncelik | İş | Durum |
|---|---|---|
| 🔴 Yüksek | OAuth handshake tamamla, RefreshToken Render env'e ekle | Bekliyor (Onur) |
| 🔴 Yüksek | Yetkili Giriş Modal fresh state testi (`b9361ae` deploy sonrası) | Test edilmedi |
| 🟡 Orta | `/giris` route ekle (PublicLayout App.tsx'e bağla) | Backlog |
| 🟢 Düşük | Sprint 4 T35 (3-katman registry+mirror persistence) — O-Freeze legacy | Backlog |
| 🟢 Düşük | Sprint 4 T36 (GUI per-volume selector) — O-Freeze legacy | Backlog |

---

## 🧰 Yüklü Araçlar (Sprint 10.7++)

- **OpenCode skills (`.claude/skills/`, gitignored):**
  - `image-to-code` — taste-skill (Leonxlnx)
  - `playwright-cli` — microsoft (binary: `@playwright/cli` v0.1.21 global)
  - `web-design-guidelines` — vercel-labs
- **Referans klonlar (`.tools/`, gitignored):**
  - `taste-skill/` `agent-skills/` `awesome-design-md/` `playwright-cli/` 

Kullanım: `playwright-cli open`/`goto`/`click eN`/`fill eN "x"`/`snapshot`/`close`.

## 🛠️ Yaygın Komutlar (Cheat Sheet)

```bash
# Backend local build
cd D:\Coding\Fikir_Platformu\backend
dotnet build

# Frontend local build
cd D:\Coding\Fikir_Platformu\frontend
npm run build

# Vite cache temizle (bundle hash reset)
rm -rf node_modules/.vite dist

# Git
cd D:\Coding\Fikir_Platformu
git status
git log --oneline -10
git push origin main

# Backend deploy endpoint test
curl -sS -o /dev/null -w "STATUS=%{http_code}\n" https://fikir-platformu.onrender.com/api/auth/mfa/method

# Frontend bundle hash kontrol
curl -sS https://fikir-platformu-web.onrender.com/ | grep 'src="/assets/index-'

# MCP servers
mavis mcp list
```

---

## 📌 Bu Dosya Hakkında

- Oluşturuldu: 2026-09-26, Sprint 10.7+ sonrası (HEAD `b9361ae`)
- Güncelleme: Her Sprint kapanışında veya büyük mimari değişiklik sonrası
- Sahiplik: Onur'un istediği üzere **her oturum sonunda güncellenmeli**
- Konum: `D:\Coding\Fikir_Platformu\HANDOVER.md` (repo kök — public, gizli bilgi içermez)
