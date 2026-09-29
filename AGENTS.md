# AGENTS.md — Fikir Platformu (Geleceğin Fikri)

> AI coding agent'lara (OpenAI Codex, Cursor, Jules, Factory, Claude Code, vb.) genel talimat.
> Projeye özgü **non-obvious patterns**, build/test komutları, PR kuralları.
> Standard: https://agents.md (60k+ OSS projesi kullanıyor).

---

## 🏗 Proje özeti (quick reference)

- **Domain:** YEGİTEK ulusal fikir platformu. İl AR-GE birimleri + bakanlık yetkilileri için fikir değerlendirme sistemi.
- **Stack:**
  - Backend: .NET 10 (`net10.0`, SDK 10.0.301) + EF Core 9 + ASP.NET Core Identity 9 (Pomelo MySQL 9.0.0)
  - Frontend: React 19.3 + Vite 8.3 + TypeScript 7 (sadece 3 runtime deps: react, react-dom, react-router-dom 7.18; pnpm 11.19.0)
  - DB: MySQL 8+ / TiDB Cloud. Üretim/demo: TiDB Cloud (`gateway01.eu-central-1.prod.aws.tidbcloud.com:4000`). **PostgreSQL yok.**
  - Mail: Sistem sabit Gmail OAuth2 (`fikir.platformu.iletisim@gmail.com`) — sprint 12'de per-user mimarisine geçilecek.
- **Deploy:** Render auto-deploy main branch push → backend Docker, frontend Static Site.
  - Backend: `https://fikir-platformu.onrender.com`
  - Frontend: `https://fikir-platformu-web.onrender.com`
  - Repo kökü `render.yaml` Blueprint (build: `npm ci && npm run build`). `infra/render.yaml` SPA-rewrite + cache-header tanımlarını taşıyan ikinci varyanttır. Blueprint yalnızca **yeni servis oluştururken** okunur; push mevcut servis ayarlarını değiştirmez.
- **CORS kritik:** `UseCors` `UseRouting`'den sonra + `UseAuthentication`'dan **ÖNCE** (`Program.cs`). `Cors__AllowedOrigins` **boşsa CORS middleware hiç kurulmaz** (same-origin mod, cookie `SameSite=Lax`). Ayrı-origin dağıtım için liste dolu olmalı; Render demo için ayrıca `Cors__AllowRenderFallback=true`. Gömülü origin fallback'i Sprint 11.52'de kaldırıldı — sıfırdan yazma.
- **Cross-origin:** Frontend + backend farklı domain → relative URL'ler SPA fallback'e düşer; `VITE_API_BASE_URL` veya `services/api.ts`'in `backendApiUrl()` helper'ı. **Koda production origin GÖMÜLMEZ** (Sprint 11.58).

## 📚 Proje belleği

- **`HANDOVER.md`** — Sprint state + açık işler (HEAD, test sayısı, env, roller/paneller, maintenance uçları).
- **`CLAUDE.md`** — Mimari, kritik dosyalar, kararlar.
- **`docs/architecture.md`** — Mimari diyagramlar, modül haritası, endpoint listesi.
- **`docs/runbook.md`** — Operations + maintenance endpoint rehberi.
- **`docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md`** — 41 maddelik kurum listesi + durum.
- **`docs/YEGITEK-TESLIM-BEKLEYEN-BILGILER.md`** — Onur'dan gerçek değeri bekleyen bilgiler.
- **`docs/adr/`** — Architecture Decision Records.
- ⚠️ **`docs/DURUM.md` ARŞİVDİR** (Aşama 0-10, 2026-09-26, PostgreSQL dönemi). Güncel endpoint/mimari için `docs/architecture.md`.

**Yeni oturumda ilk iş:** `AGENTS.md` → `CLAUDE.md` → `HANDOVER.md` oku. Sonra devam et.

---

## 🛠 Dev environment tips

- **Sandbox:** Windows kernel sandbox. `dotnet ef migrations add` dosya yazma sorunu var — Sprint 11'de startup idempotent raw SQL ile çözüldü. **Yeni migration gerekirse lokal geliştirici makinede CI veya temiz bash'te üret.** Mevcut migration'lar: `InitialMySql`, `AddAuthSecurity`, `FixPasswordChangedAtType`.
- **Backend `dotnet build`** → tüm projeler derlenir. `cd backend && dotnet build -c Release --nologo` kullan (Release, hızlı).
- **Frontend `pnpm build`** → `tsc -b && vite build`. Build sonrası `dist/assets/` içinde SHA-prefixed dosyalar. (paket yöneticisi **pnpm 11.19.0**, `npm` değil)
- **Frontend kilit dosyaları iki tane:** `pnpm-lock.yaml` (lokal geliştirme, pnpm) ve `package-lock.json` (Render Static Site build'i `npm ci && npm run build` kullandığı için). **Bağımlılık eklediğinde/guncellediğinde `bash scripts/sync-npm-lock.sh` calistir** — aksi halde Render build'i eski kilitle calisir veya basarisiz olur.
- **Git config:** `git -c user.name=OnurCorptr -c user.email=onur35bilisim@gmail.com commit` — global config yok.
- **Internet search zorunlu** her fix öncesi (Onur kuralı). `Microsoft Learn`, `context7`, `brave_web_search` tool'ları kullan.
- **Test:** Backend'de xUnit var — `backend/tests/FikirPlatformu.Tests` (**51 test, 6 dosya**: `IdeaTests` 6, `SubmitIdeaServiceTests` 3, `Rfc2047Tests` 6, `ProfanityTextMatcherTests` 8, `GuvenliYonlendirmeTestleri` 24, `ProgramYapilandirmaDenetimi` 4). `scripts/verify.ps1` `dotnet test` çalıştırır. **Frontend'de Vitest yok** — UI doğrulama Playwright ile manual (`public/mobil-test.html` ölçüm sayfası).
- 🔴 **"Derleniyor + testler geçiyor" yetmez (Sprint 11.84).** DI konteyneri `builder.Build()` sonrası dondurulur; sonraya yazılan `builder.Services.*` çağrısı derleme hatası vermez, 23/23 test yeşil kalır, uygulama **çalışırken** çöker ("service collection cannot be modified because it is read-only"). `ProgramYapilandirmaDenetimi` bu sınıfı yakalar. Canlıda hangi build'in çalıştığını `/api/health` → `commit` alanından doğrula.
- **Olç, tahmin etme.** Genişlik/taşma/renk gibi ölçülebileni ölç. Görüntülemeden UI değişikliği yapma.

## 🧪 Testing & verification

- **Backend health:** `curl https://fikir-platformu.onrender.com/api/health` → `{"status":"healthy",...}` (ayrıca `/api/health/db`).
- **CORS verify:** OPTIONS preflight `Origin: https://fikir-platformu-web.onrender.com` → 204 + `Access-Control-Allow-Origin` header.
- **Frontend smoke:** Playwright ile login flow (Yetkili Girişi → Captcha → MFA → Admin).
- **Bundle hash verify:** `dist/assets/index-*.js` SHA-prefix → `HANDOVER.md`'deki HEAD commit ile eşleşmeli.
- **Build deterministic SHA:** Aynı source → aynı bundle hash.
- 🔴 **Auth zinciri kuralı (Sprint 11.71–11.78):** "derleniyor + testler geçiyor" **yetersizdir**. Login → cookie → `/me` → `ProtectedRoute` → endpoint politikası zincirinde değişiklik yapıyorsan **gerçek çalışma yolunu uçtan uca çalıştır**. Dört tur üst üste yanlış kök neden bulundu; hepsi derlendi ve testler geçti, kullanıcı sessizce ana sayfaya atılıyordu. Sessiz hata kabul edilmez — `ProtectedRoute` panel oturumu yoksa **açık uyarı** göstermeli.

## 🎨 Coding conventions (non-obvious)

- **Türkçe karakterler** entity/role name'lerde YOK — Identity DB'de `SystemAdmin`, `ProvinceManager` (English). UI Türkçe label için `frontend/src/services/roles.ts` `rolAdi()` helper'ı (`ROLE_DISPLAY`) kullan.
- **Domain types** Türkçe property name ile: `OnaylamaTuru`, `KayitIstegi`, vb. C# field'lar büyük harf PascalCase.
- **Frontend class names** kebab-case Türkçe: `yetkili-giris-modal`, `admin-kart-baslik`. CSS `.yetkili-giris-modal`.
- **Rol → panel eşlemesi tek kuralda:** `frontend/src/components/YetkiliPanelSecim.tsx` → `ilYoneticiMi()`, `rolPanelSecenekleri()`, `rolEtiketi()`. Doğrudan `roles.includes("...")` **yazma** — aynı hata Sprint 11.80'de üç ayrı yerde tekrar etmişti.
- **`/me` context'i rolden tahmin etme:** `AuthEndpoints.KullaniciBilgisiGetir` context'i **çağırandan** (doğrulanmış cookie scheme) alır (Sprint 11.78, commit `adac877`). Rolden türetmek sistem yöneticisinin province cookie'sini `ministry` diye etiketler ve panel erişimi sessizce çöker.
- **Rol claim'leri `CreateUserPrincipalAsync` içinde otomatik gelmez** — `IsInRole()` her zaman false dönebilir. Rol claim'leri açıkça yazılır (Sprint 11.76).
- **HTTP error handling:** `ApiHttpError.message` parse et, generic fallback gösterme. `services/api.ts` sırasıyla `message` → `errors[]` → RFC 7807 `detail` → `title` → Türkçe HTTP fallback kullanır.
- **Identity EmailConfirmed** default `false`. **Her başarılı şifre sıfırlama yolu** `MustChangePassword=false` + `PasswordChangedAt=now` yazmalı (Sprint 11.x kalıcı kural).
- **Parola yaşı:** uyarı 75 gün, zorunlu 90 gün (`Domain/Auth/SifreYasiPolicy.cs`). Zorlama `MinistryOfficial` zorunlu; `Student`/`ProvinceEvaluator`/`ProvinceManager` tavsiye; `SystemAdmin` muaf.
- **Türkçe UI metni** UTF-8 + `\`...\` Türkçe tırnak ("..." değil). Telefon/email `spellCheck={false}`.
- **useNavigate SPA nav** Modal içinde çalışmaz (React Router v7 declarative mod). Modal → `YetkiliPanelSecim.fullPageNav()` (`window.location.href`) kullan.
- **HttpOnly cookie** `document.cookie`'den okunamaz — backend 200/401 response'a güven.
- **CSS yükleme sırası tuzağı:** `src/` CSS'i Vite'in `/assets/index-*.css` dosyasında gelir ve `public/assets/css/stil.css`'i **ezebilir** (özgüllük). Sprint 11.68'de ana sayfa rozetleri bu yüzden görünmüyordu.
- **Non-ASCII MIME header** (Gmail From görünen adı) RFC 2047 encoded-word olmalı; ham UTF-8 başlık metni mojibake üretir (Sprint 11.59, `Rfc2047Tests`).

## 🚀 PR & commit conventions

- **Commit format:** `Sprint X.Y: kısa açıklama` (Türkçe veya İngilizce, kısa). Conventional Commits zorunlu değil.
- **Commit body:** sadece "why" açık değilse yaz.
- **Her önemli değişiklik → commit + push.** Onay kısa: "ONAYLIYORUM", "A", "devam et".
- **Auto-deploy:** main branch push → Render backend + Static Site otomatik deploy. Build süresi ~2 dk.
- **Bundle adı:** `index-<hash>.js` — yeni commit push'undan ~2 dk sonra yeni bundle aktif.
- **Şifre/hesap hiçbir dosyaya yazılmaz** (HANDOVER.md, `.env`, scripts dâhil).

## ⚠️ Kırmızı çizgiler (asla yapma)

- ❌ `Mail__Gmail__ClientSecret` **ASLA** repo'ya commit etme. SECRET env'den okunur. (`Mail__Gmail__RefreshToken` Sprint 11.36 ile tamamen kalktı — token DB'de şifreli, `gmail_refresh_tokens`.)
- ❌ Production DB'de öğrenci kayıt bilgilerine `/api/admin/users*` endpoint'inden erişim. `GET /users` rol filtresi beyaz listeye bağlı (`SystemAdmin`, `MinistryOfficial`, `ProvinceManager`, `ProvinceEvaluator`); `Student` rollü kayıtlar listeden çıkarılır (Sprint 11 privacy guard).
- ❌ Toplu CSV import'ta sadece istemcinin gönderdiği uzantı/MIME'ye güvenme — `.csv` uzantısı **ve** izinli MIME **ve** beklenen başlıklar doğrulanmalı (Sprint 11.63).
- ❌ Frontend bundle'da `import.meta.env.DEV` ile hardcoded secret **veya** production origin. Sadece `VITE_*` env'ler bundle'a girer.
- ❌ CORS preflight 401 dönüyorsa `UseAuthentication`'ı `UseCors`'tan önce koyma — Microsoft Learn: UseCors after UseRouting, before UseAuthorization.
- ❌ `/api/__maintenance/*` ve `/api/auth/__debug/*` endpoint'lerini production'da bırakma — Sprint 12'de silinecek. `AdminMaintenance__Secret` tanımlı değilse 403 döner (fail-closed), bu kasıtlı.
- ❌ Kod içine gömülü e-posta/şifre/credential. Startup seed'i yalnızca `SeedSystemAdmin__Email` **+** `SeedSystemAdmin__Password` ikisi de tanımlıysa ve hesap yoksa çalışır; `seed` komutu hedef DB boş değilse hiçbir şey yazmaz.
- ❌ PostgreSQL/PgSql getirme. Provider Pomelo MySQL 9.0.0. `compose.yaml` (PostgreSQL 18) Sprint 11.52'de silindi — **yeniden ekleme**.
- ❌ 2MB+ dosyayı git'e ekleme (`.tools/`, `.playwright-cli/`, `node_modules/` gitignore'lı).

## 🌐 Domain & i18n

- **Default UI language:** Türkçe. Backend validation mesajları Türkçe (`"E-posta veya şifre geçersiz."`).
- **Tarih/saat:** `Intl.DateTimeFormat('tr-TR')` veya `.toLocaleDateString('tr-TR')`.
- **Para birimi:** YOK (platform ücretsiz).
- **Sayılar:** `Intl.NumberFormat('tr-TR')` gerekirse.

## 📞 Kullanıcı (Onur) iletişim tarzı

- **Caveman modu varsayılan ON** — Türkçe ultra-terse. `/caveman off` yazmadıkça.
- **Onay kısa:** "ONAYLIYORUM", "A", "devam et".
- **Safety warning / irreversible action** durumunda caveman otomatik düşer.
- **Uzun açıklama sevmiyor**; detay sadece kritik durumda.

---

*Bu dosya proje kökünde. PR ile değiştir. Sprint state ve açık işler için `HANDOVER.md`.*
