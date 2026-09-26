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

## 📜 Sprint Tarihçesi (HEAD: `b9361ae`)

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
