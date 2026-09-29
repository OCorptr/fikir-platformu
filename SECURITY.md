# Geleceğin Fikri — Güvenlik Uygulama Özeti

Kurum (YEĞİTEK) 41 maddelik güvenlik listesine uyum durumu için kaynak doküman:
**`docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md`**. Bu dosya uygulamanın nasıl
güvence sağladığını anlatır; madde bazlı uyum matrisi oradadır.

> Son güncelleme: **Sprint 11.81** · Kod tabanı: `20d1df7`

---

## 📊 Sprint Durumu

| Sprint | Kapsam |
|---|---|
| 1 | DB geçişi (PostgreSQL → Pomelo MySQL / TiDB Cloud) |
| 2 | Identity güçlendirme (şifre / lockout) + `auth_events` audit |
| 3 | Cookie + CORS + open-redirect koruması + idle timeout |
| 4 | DTO doğrulama (DataAnnotations) |
| 5 | Rate limit + güvenlik header + log retention |
| 6 | TOTP MFA (setup / verify / login / disable) |
| 7 | Ayrıcalıklı roller için MFA zorunluluğu |
| 8.1–8.4 | CAPTCHA, PII log maskeleme, TOTP secret şifreleme, WCAG erişilebilirlik, composite index |
| 9–10 | SystemAdmin kullanıcı yönetimi, e-posta OTP, Gmail API, cross-context guard |
| 11.1–11.50 | Admin panel, bulk CSV, privacy guard, dokümantasyon sistemi |
| **11.51** | **Sertleştirme:** Gmail token env'e (DB tablosu düştü), üretim CORS fallback'i kaldırıldı, `Captcha__Disabled` |
| **11.52** | **Teslim hazırlığı:** canlı DB parolası taşıyan `seed/ilk_hesaplar.py` **silindi**, bayat `compose.yaml` silindi, `deploy/nginx/fikir.conf` eklendi, **CSP + HSTS** eklendi, `AdminMaintenance__Secret` zorunlu |
| **11.53** | **Parola politikası 5 sınıfa** (≥8, büyük, küçük, rakam, özel karakter) + Türkçe hatalar; ölü `BypassPasswordValidator` kaldırıldı; **pasif hesap servisi geri açıldı** (YG-16, YG-39) |
| **11.59** | Gmail gönderen adı mojibake → RFC 2047 encoded-word |
| **11.60** | **90 günlük parola yaşı zorlanır**, 75 gün uyarı, rol tabanlı (YG-17) |
| **11.61–11.63** | Denetim raporları (gece 02:00 UTC), her sayfadan çıkış, CSV üç katmanlı beyaz liste |
| **11.71–11.78** | Sistem yöneticisi üç panele erişir; **rol claim'leri girişte açıkça yazılır**; `/me` context'i çağırandan alır |
| **11.79–11.80** | Yetki kuralları tek kaynaktan (`YetkiliPanelSecim.ilYoneticiMi()`) |

---

## 🔐 Uygulanan Kontroller

### Kimlik Doğrulama

**Parola politikası** (`Program.cs:203-207`):

| Kural | Değer |
|---|---|
| `RequiredLength` | 8 |
| `RequireUppercase` | true |
| `RequireLowercase` | true |
| `RequireDigit` | true |
| `RequireNonAlphanumeric` | true |

- Frontend doğrulaması `frontend/src/services/sifreKurallari.ts` — backend ile birebir aynı kurallar
- Identity hataları `SifreKuraliMesaji` ile **Türkçeye** çevrilir
- Öğrenci kayıt uçları da aynı politikayı uygular
- **Lockout:** 5 başarısız deneme / dakika (IP bazlı rate limit ayrıca var)
- **MFA zorunlu rolleri** (`AuthEndpoints.cs:256`): `MinistryOfficial`, `ProvinceManager`, `SystemAdmin`
- **TOTP secret** Data Protection API ile şifreli (`HassasVeriSifreleme` + `data_protection_keys` tablosu)

> 📌 **Sprint 11.7'de eklenen `BypassPasswordValidator` kaldırıldı (11.53).** İşe yaramıyordu:
> `AddPasswordValidator` `TryAdd` değil `Add` kullanır ve `AddIdentityCore` varsayılan
> doğrulayıcıyı zaten kaydetmiştir — yani kod her zaman kuralları uyguluyordu.
> Kurum "özel karakter zorunlu" dediği için politika **sıkılaştırıldı**, gevşetilmedi.

### Parola Yaşı (YG-17)

| Özellik | Değer |
|---|---|
| Uyarı eşiği | 75 gün |
| Zorlama eşiği | 90 gün |
| `MinistryOfficial` | **zorunlu** değiştirme |
| `Student`, `ProvinceEvaluator`, `ProvinceManager` | tavsiye (uyarı gösterilir) |
| `SystemAdmin` | muaf |

- `/api/auth/me` → `sifreDegistirmeZorunlu` alanı döner
- Global `SifreKilit` bileşeni kullanıcıyı `/sifre-degistir`'e yönlendirir, gezinmeyi engeller
- Mevcut kayıtlar **son giriş tarihinden geriye dönük** doldurulur (özellik eklenirken herkesin kilitlenmemesi için)
- Başarılı parola sıfırlamada `MustChangePassword=false` + `PasswordChangedAt` güncellenir

### Oturum Yönetimi

| Özellik | Değer |
|---|---|
| Cookie | `HttpOnly` ✓ |
| `SecurePolicy` | Production → `Always`, Development → `SameAsRequest` |
| `SameSite` | CORS listesi **doluysa** `None` (cross-origin), **boşsa** `Lax` (same-origin nginx) |
| Idle timeout | 30 dakika (sliding) |
| Absolute timeout | 8 saat (`auth_issued_at` claim + `OnValidatePrincipal`) |
| Rate limit | Global 100 req/dk/IP, login 5 req/dk/IP |

**4 cookie scheme** (`Program.cs`): `IdentityConstants.ApplicationScheme` (öğrenci), `ProvinceScheme`, `MinistryScheme`, `PreMfaScheme` (MFA öncesi 10 dakikalık yarım oturum).

**Rol claim'leri girişte açıkça yazılır** (`MfaEndpoints.RolleriEkle`, Sprint 11.76). `CreateUserPrincipalAsync` yalnızca kullanıcı claim'i üretir; politika `IsInRole(...)` ile cookie içindeki role baktığı için claim'ler burada ekleniyor.

### Yetkilendirme

**Policy bazlı**, her biri kendi cookie scheme'i ile:

| Policy | Scheme | Kabul ettiği roller |
|---|---|---|
| `StudentOnly` | `ApplicationScheme` | `Student` |
| `ProvinceOnly` | `ProvinceScheme` | `ProvinceManager`, `ProvinceEvaluator`, **`SystemAdmin`** |
| `MinistryOnly` | `MinistryScheme` | `MinistryOfficial` |

> 📌 **Kurum kuralı:** *"Sistem Yöneticisi dışında kimsede birden fazla panele erişemez."*
> Sistem yöneticisi **istisnadır** — üç panelin de yönetim işlerini yapar ve `il-panel`'da
> **tüm illeri** görür (`ilId = null` → il filtresi uygulanmaz).

Frontend yetki kodu **her zaman** `YetkiliPanelSecim.ilYoneticiMi()` gibi ortak bir
kurala bakar; doğrudan `roles.includes("...")` yazmaz (Sprint 11.80 — bu hata üç ayrı
sayfada tekrarlamıştı).

### Veri Güvenliği

- DTO doğrulama: `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`
- 400 + `ValidationProblemDetails` (built-in .NET 10 `AddValidation()`)
- **XSS:** React varsayılan escape; `dangerouslySetInnerHTML` **yok**
- **CSRF:** SameSite cookie + JSON content-type (cross-origin bloklanır)
- **Open redirect:** `YerelUrlYardimci.GuvenliMi()` — protocol-relative ve external engelli
- **Hata yanıtları** istisna metnini istemciye sızdırmaz (Sprint 11.52)

### Dosya Yükleme (CSV beyaz listesi)

Uygulamada genel amaçlı dosya yükleme **yok**. Tek dosya girişi admin CSV toplu
import'u (`POST /api/admin/users/bulk`) ve **üç katmanlı** beyaz listeye sahip:

1. `.csv` uzantısı
2. MIME: `text/csv`, `application/csv`, `text/plain`, `application/vnd.ms-excel`, `application/octet-stream`
3. İçerikte zorunlu başlık sütunları mevcut

> Uzantı ve MIME **istemci kontrollüdür** — bu yüzden üçü birlikte uygulanır. Dosya
> diske yazılmaz, yalnızca ayrıştırılır (yol geçişi riski yok).

### Audit & Log

- `auth_events` tablosu: `LoginSuccess`, `LoginFailure`, `LockedOut`, `EmailNotConfirmed`,
  `Logout`, `PasswordChanged`, `Mfa*`, **`AccountDisabled`**
- Tüm auth olayları IP + UserAgent ile
- **PII maskeleme:** e-posta `a***@domain`, IP maskeli (`KisiselVeriYardimci`, Sprint 8.1).
  Sprint 11.52'de login ve şifre-sıfırlama loglarındaki düz metin e-postalar da maskelendi;
  `MaskOldAuthEventsPii` migration'ı ile eski kayıtlar temizlendi
- **Retention:** `AuthEventRetentionService` — 730 gün (2 yıl), 24 saatte bir
- **Denetim raporları:** `DenetimRaporServisi` her gece **02:00 UTC**'de JSONL + yönetici
  CSV özeti üretir; Admin Panel → Denetim Raporları ekranından indirilir

> ⚠️ **Eksik (YG-13/YG-18):** Hareket kayıtları **kurumun merkezî sistemine otomatik
> iletilmiyor**. Dosya/betik aktarımı tam uyum sayılmaz. Hedef URL/protokol kurumdan bekleniyor.

### Pasif Hesap Yönetimi (YG-39)

- `PasifHesapTespitService` **aktif** (Sprint 11.53)
- 90 gün hareketsizlikte hesap kilitlenir (`LockoutEnd = MaxValue`) ve `auth_events`'e
  `AccountDisabled` yazılır → kalıcı denetim izi
- **Ayrıcalıklı roller muaf:** `SystemAdmin` ve `MinistryOfficial` asla otomatik
  kilitlenmez (aksi halde sisteme kimse giremez)
- Hiç giriş kaydı olmayan hesaplar atlanır
- Yönetici uçları: `GET /api/admin/pasif-hesaplar`, `POST /api/admin/pasif-hesaplar/tekrar-aktiflestir`
- Ayarlar: `PasifHesap_Enabled`, `PasifHesap_GunSayisi` (90), `PasifHesap_KontrolGunu` (30)

### CORS ve TLS

**CORS** (`BakimCORS.cs`):

| Ortam | Davranış |
|---|---|
| `Cors__AllowedOrigins` dolu | Bu originler; CORS middleware açılır; cookie `SameSite=None` |
| `Cors__AllowedOrigins` boş + Development | `localhost:5173`, `localhost:5174` |
| `Cors__AllowedOrigins` boş + Production + `Cors:AllowRenderFallback=true` | Render origin (varsayılan **kapalı**) |
| `Cors__AllowedOrigins` boş + Production | `[]` → same-origin (nginx reverse proxy) |

> 📌 **Sprint 11.51:** Üretimdeki gömülü Render origin'i **kaldırıldı**. Artık ya
> `Cors__AllowedOrigins` açıkça verilir ya da same-origin nginx kurulur.

**TLS/HTTP güvenliği** (Sprint 11.52):

- `deploy/nginx/fikir.conf` — `ssl_protocols TLSv1.2 TLSv1.3`, güçlü cipher suite, SPA fallback
- `Content-Security-Policy` — `Program.cs:547`, `Security:ContentSecurityPolicy` ile override edilebilir
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — `Program.cs:560`
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`

### Erişilebilirlik (WCAG, Sprint 8.3)

- `skip-to-main` klavye atlama bağlantısı
- `focus-visible` global odak halkası
- `aria-live="polite"` durum bildirimi, `role="alert"` hata sayfaları
- Aktif menü öğesi `aria-current="page"` ile işaretli
- `@media (prefers-contrast: more)` yüksek kontrast
- `@media (prefers-reduced-motion: reduce)` hareket azaltma
- Tüm tablolarda `<caption class="sr-only">`

---

## 📋 Endpoint Matrisi

| Endpoint | Auth | MFA | Rate Limit | Audit |
|---|---|---|---|---|
| `POST /api/auth/register` | — | — | Global | — |
| `POST /api/auth/login` | — | — | Login 5/dk | ✓ |
| `GET/POST /api/auth/captcha/{new,verify}` | — | — | Global | — |
| `POST /api/auth/change-password` | Cookie | — | Global | ✓ |
| `POST /api/auth/logout` | Cookie | — | Global | ✓ |
| `POST /api/auth/forgot-password` · `reset-password` | — | — | Global | ✓ |
| `GET /api/auth/mfa/method` | `PreMfaScheme` | — | Login 5/dk | — |
| `POST /api/auth/mfa/send-email-otp` | `PreMfaScheme` | — | Login 5/dk | ✓ |
| `POST /api/auth/mfa/setup` · `verify-setup` | Cookie | — | Global | ✓ |
| `POST /api/auth/mfa/verify` | `PreMfaScheme` | — | Login 5/dk | ✓ |
| `POST /api/auth/mfa/disable` | Cookie | Privileged → **bloklu** | Global | ✓ |
| `GET /api/auth/me` | Cookie | — | Global | — |
| `/api/student/ideas*` | `StudentOnly` | — | Global | — |
| `/api/province/*` | `ProvinceOnly` | — | Global | ✓ |
| `/api/ministry/*` | `MinistryOnly` | — | Global | ✓ |
| `/api/admin/users*` | `SystemAdmin` | — | Global | ✓ |
| `/api/admin/pasif-hesaplar*` | `SystemAdmin` | — | Global | ✓ |
| `/api/__maintenance/*` · `/api/auth/__debug/*` | `?token=` gizli anahtar | — | Yok | ✓ |

> ⚠️ Maintenance endpoint'leri **Sprint 12'de production'dan kaldırılacak.** Şu an
> `AdminMaintenance__Secret` ile korunuyor; **gömülü varsayılan yok** — değişken
> tanımlı değilse hepsi 403 döner.

---

## ✅ Doğrulanmış Test Senaryoları

- CORS beyaz listesi (`localhost:5173` ✓, dış origin ✗)
- Cookie: HttpOnly + SameSite + SecurePolicy (env-aware)
- Open redirect: protocol-relative + external bloklu
- DataAnnotations: geçersiz kayıt → 400 + alan bazlı mesajlar
- Rate limit: 5 login sonrası 429
- Güvenlik header'ları: `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy` + CSP + HSTS
- MFA kurulum → doğrulama → giriş (3 adım)
- MFA kapatma (ayrıcalıklı rol bloklu)
- Parola politikası: 5 sınıf, Türkçe hata mesajı
- Pasif hesap: 90 gün → kilitleme + `AccountDisabled` kaydı
- Backend xUnit: **23/23** (`backend/tests/FikirPlatformu.Tests`)

> Frontend'de birim test çerçevesi **yok** (Vitest kurulmadı). Arayüz doğrulaması
> **manuel Playwright** ile yapılır; mobil davranış `frontend/public/mobil-test.html`
> üzerinden 320–1920px aralığında ölçülür.

---

## 📋 TODO (Production Öncesi)

- [x] TOTP secret DB şifreleme (Data Protection API) — Sprint 8.2
- [x] CSP header — Sprint 11.52
- [x] HSTS header — Sprint 11.52
- [x] Canlı sır temizliği (`seed/ilk_hesaplar.py` silindi) — Sprint 11.52
- [ ] **YG-38 — güvenlik testi dokümanı** (test raporu)
- [ ] **YG-13/18 — merkezî log iletimi** (kurum altyapısı bekleniyor)
- [ ] YG-08 — öğrenci PII'si depolama şifrelemesi
- [ ] Maintenance endpoint'lerini production'dan kaldır (Sprint 12)
- [ ] Serilog → Elasticsearch/Seq sink (yapısal log)
- [ ] OWASP ZAP / Burp Suite penetration testi
- [ ] Erişilebilirlik denetimi (WAVE / axe DevTools)

---

*Uygulama matrisi ve madde bazlı kanıtlar: `docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md` (37/41 tam, 4 kısmi).*
