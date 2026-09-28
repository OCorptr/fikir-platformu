# AGENTS.md — Fikir Platformu (Geleceğin Fikri)

> AI coding agent'lara (OpenAI Codex, Cursor, Jules, Factory, Claude Code, vb.) genel talimat.
> Projeye özgü **non-obvious patterns**, build/test komutları, PR kuralları.
> Standard: https://agents.md (60k+ OSS projesi kullanıyor).

---

## 🏗 Proje özeti (quick reference)

- **Domain:** YEGİTEK ulusal fikir platformu. İl AR-GE birimleri + bakanlık yetkilileri için fikir değerlendirme sistemi.
- **Stack:**
  - Backend: .NET 10 + EF Core 9 + ASP.NET Core Identity 9 (Pomelo MySQL provider)
  - Frontend: React 19 + Vite 8 + TypeScript 7 (sadece 3 runtime deps: react, react-dom, react-router-dom; pnpm 11)
  - DB: TiDB Cloud Frankfurt (`gateway01.eu-central-1.prod.aws.tidbcloud.com:4000`)
  - Mail: Sistem sabit Gmail OAuth2 (`fikir.platformu.iletisim@gmail.com`) — sprint 12'de per-user mimarisine geçilecek.
- **Deploy:** Render auto-deploy main branch push → backend Docker, frontend Static Site.
  - Backend: `https://fikir-platformu.onrender.com`
  - Frontend: `https://fikir-platformu-web.onrender.com`
- **CORS kritik:** UseCors `UseRouting`'den sonra + `UseAuthentication`'dan ÖNCE. Default origins hardcoded fallback (env yoksa).
- **Cross-origin:** Frontend + backend farklı domain → relative URL'ler SPA fallback'e düşer; OAuth + API call'lar `services/api.ts`'in `backendApiUrl()` helper'ı ile absolute.

## 📚 Proje belleği

- **`CLAUDE.md`** — Claude-specific project memory (mimari, sprint state, kritik dosyalar, kararlar).
- **`HANDOVER.md`** — Sprint state + açık işler (kısa, odaklı).
- **`docs/architecture.md`** — Mimari diyagramlar, modül haritası.
- **`docs/runbook.md`** — Operations + maintenance endpoint rehberi.
- **`docs/adr/`** — Architecture Decision Records (neden kararlar verildi).

**Yeni oturumda ilk iş:** `CLAUDE.md` + `HANDOVER.md` oku. Sonra devam et.

---

## 🛠 Dev environment tips

- **Sandbox:** Windows kernel sandbox. `dotnet ef migrations add` dosya yazma sorunu var — Sprint 11'de startup idempotent raw SQL ile çözüldü. **Yeni migration gerekirse lokal geliştirici makinede CI veya temiz bash'te üret.**
- **Backend `dotnet build`** → tüm projeler derlenir. `cd backend && dotnet build -c Release --nologo` kullan (Release, hızlı).
- **Frontend `pnpm build`** → Vite content-based hash bundle üretir. Build sonrası `dist/assets/` içinde SHA-prefixed dosyalar. (paket yöneticisi **pnpm 11**, `npm` değil)
- **Frontend kilit dosyaları iki tane:** `pnpm-lock.yaml` (lokal geliştirme, pnpm kullanır) ve `package-lock.json` (Render Static Site build'i `npm ci && npm run build` kullanır). **Bağımlılık eklediğinde/guncellediğinde `bash scripts/sync-npm-lock.sh` calistir** — aksi halde Render build'i eski kilitle calisir veya basarisiz olur.
- **Git config:** `git -c user.name=OnurCorptr -c user.email=onur35bilisim@gmail.com commit` — global config yok.
- **Internet search zorunlu** her fix öncesi (Onur kuralı). `Microsoft Learn`, `context7`, `brave_web_search` tool'ları kullan.
- **Test:** Backend'de xUnit var — `backend/tests/FikirPlatformu.Tests` (17 test, 3 dosya: `IdeaTests`, `ProfanityTextMatcherTests`, `SubmitIdeaServiceTests`). `scripts/verify.ps1` `dotnet test` çalıştırır. **Frontend'de Vitest yok** — UI doğrulama Playwright ile manual.

## 🧪 Testing & verification

- **Backend health:** `curl https://fikir-platformu.onrender.com/api/health` → `{"status":"healthy",...}`
- **CORS verify:** OPTIONS preflight `Origin: https://fikir-platformu-web.onrender.com` → 204 + `Access-Control-Allow-Origin` header.
- **Frontend smoke:** Playwright ile login flow (Yetkili Girişi → Captcha → MFA → Admin).
- **Bundle hash verify:** `dist/assets/index-*.js` SHA-prefix → `HANDOVER.md`'deki HEAD commit ile eşleşmeli.
- **Build deterministic SHA:** Aynı source → aynı bundle hash.

## 🎨 Coding conventions (non-obvious)

- **Türkçe karakterler** entity/role name'lerde YOK — Identity DB'de `SystemAdmin`, `ProvinceManager` (English). UI Türkçe label için `frontend/src/services/roles.ts` `rolAdi()` helper'ı kullan.
- **Domain types** Türkçe property name ile: `OnaylamaTuru`, `KayitIstegi`, vb. C# field'lar büyük harf PascalCase.
- **Frontend class names** kebab-case Türkçe: `yetkili-giris-modal`, `admin-kart-baslik`. CSS `.yetkili-giris-modal`.
- **HTTP error handling:** `ApiHttpError.message` parse et, generic fallback gösterme. Frontend `services/api.ts` RFC 7807 `detail` parse eder.
- **Identity EmailConfirmed** default `false`. MfaSetup sonrası `MustChangePassword=true` set et. Sprint 11.48 ile maintenance endpoint'ten flag kapatılabilir.
- **Türkçe UI metni** UTF-8 + `\`...\` Türkçe tırnak ("..." değil). Telefon/email `spellCheck={false}`.
- **useNavigate SPA nav** Modal içinde çalışmaz (React Router v7 declarative mod). Modal → `window.location.href = "/..."` kullan.
- **HttpOnly cookie** `document.cookie`'den okunamaz — backend 200/401 response'a güven.

## 🚀 PR & commit conventions

- **Commit format:** `Sprint X.Y: kısa açıklama` (Türkçe veya İngilizce, kısa). Conventional Commits zorunlu değil.
- **Commit body:** sadece "why" açık değilse yaz.
- **Her önemli değişiklik → commit + push.** Onay kısa: "ONAYLIYORUM", "A", "devam et".
- **Auto-deploy:** main branch push → Render backend + Static Site otomatik deploy. Build süresi ~2 dk.
- **Bundle adı:** `index-<hash>.js` — yeni commit push'undan ~2 dk sonra yeni bundle aktif.

## ⚠️ Kırmızı çizgiler (asla yapma)

- ❌ `Mail__Gmail__ClientSecret` **ASLA** repo'ya commit etme. SECRET env'den okunur. (`Mail__Gmail__RefreshToken` Sprint 11.36 ile tamamen kalktı — token DB'de şifreli, `gmail_refresh_tokens`.)
- ❌ Production DB'de student kayıt bilgilerine `/api/admin/users*` endpoint'inden erişim. Admin scope filtre zorunlu (`/api/admin/users` whitelist: SystemAdmin, MinistryOfficial, ProvinceManager, ProvinceEvaluator). Sprint 11 privacy guard.
- ❌ Frontend bundle'da `import.meta.env.DEV` ile hardcoded secret. Sadece `VITE_*` env'ler bundle'a girer.
- ❌ CORS preflight 401 dönüyorsa `UseAuthentication`'ı `UseCors`'tan önce koyma — Microsoft Learn: UseCors after UseRouting, before UseAuthorization.
- ❌ `/api/__maintenance/*` endpoint'lerini production'da bırakma — Sprint 12'de silinecek.
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
