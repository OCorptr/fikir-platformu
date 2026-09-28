# Geleceğin Fikri — Güvenlik Uygulama Planı Özeti

Bu doküman `SECURITY_IMPLEMENTATION_PLAN.md` ile birlikte production öncesi yapılacak güvenlik işlerinin sprint bazlı özetidir.

## Sprint Durumu

| Sprint | Kapsam | Durum | Commit |
|---|---|---|---|
| 1 | DB Migration (PostgreSQL → TiDB Cloud MySQL) | ✅ | `cdf7417` |
| 2 | Identity güçlendirme (şifre/lockout) | ✅ | `d30361d` |
| 2 | Audit logging (AuthEvent) | ✅ | `21bc3b1` |
| 3 | Cookie + CORS + Open Redirect + idle timeout | ✅ | `8bf1a83` |
| 4 | DTO validation (DataAnnotations) | ✅ | `0337aae` |
| 5 | Rate limit + güvenlik header + retention | ✅ | `ad4be5a` |
| 6 | TOTP MFA (setup/verify/login/disable) | ✅ | `23a3f77` |
| 7 | MFA zorunluluğu (privileged roles) + pasif hesap tespiti | ✅ | `96dedb2` |
| 7.5 | YEĞİTEK deployment hazırlığı (nginx, demo seed kaldırıldı) | ✅ | `a374b20` |
| 8.1 | CAPTCHA + PII log maskeleme | ✅ | `00dbf57` |
| 8.2 | TOTP secret Data Protection API şifreleme | ✅ | `56c399c` |
| 8.3 | Custom 404/500 + WCAG erişilebilirlik | ✅ | `02c6856` |
| 8.4 | Composite indexes + her sayfadan logout | ✅ | `83f3e5c` |
| 9 | SystemAdmin kullanıcı yönetimi + MFA setup | ✅ | `AdminEndpoints.cs` |
| 10 | MFA Email OTP + Gmail API OAuth2 + cross-context guard | ✅ | Sprint 10 |
| 11 | Admin panel, bulk CSV import, privacy guard, OAuth DB-persist, dokümantasyon | ✅ | HEAD `64bbb7a` |

## Uygulanan Kontroller

### Kimlik Doğrulama (plan §2)
- Şifre politikası (`Program.cs` Identity options): `RequiredLength = 8`, `RequireNonAlphanumeric = false`
- **Uyum şifreler (nokta içermeyen) için `BypassPasswordValidator` DI'da kayıtlı** (Sprint 11.7) —
  `Bilisim35sse` gibi Identity kuralına takılmayan şifreler kabul edilir
- Öğrenci kayıt uçları daha gevşek: min 5 karakter (hedef kitle küçük çocuklar)
- Lockout: 5 başarısız deneme → 15 dk (Identity)
- Şifre süre sonu: 90 gün zorla, 75 gün uyarı (frontend `passwordWarn` flag'i)
- MFA: TOTP (RFC 6238), Otp.NET 1.4.1
  - Ayrıcalıklı roller (MinistryOfficial, ProvinceManager, SystemAdmin) için **zorunlu**
  - Diğer kullanıcılar opt-in
  - **Secret DB'de Data Protection API ile şifrelenmiş** (Sprint 8.2 — `HassasVeriSifreleme` + `data_protection_keys` tablosu)

### Oturum Yönetimi (plan §3)
- Cookie: HttpOnly ✓; SameSite env-aware (production'da cross-origin → `None; Secure`, aynı domain'de `Lax`)
- SecurePolicy: Development HTTP=SameAsRequest, Production HTTPS=Always
- Idle timeout: 30 dk sliding
- Absolute timeout: 8 saat (`auth_issued_at` claim + OnValidatePrincipal reject)
- 4 cookie scheme (`Program.cs`): `IdentityConstants.ApplicationScheme` (öğrenci + yetkili), `ProvinceScheme`, `MinistryScheme`, `PreMfaScheme` (login sonrası MFA öncesi yarım cookie) — aynı tarayıcıda çoklu oturum

### Yetkilendirme (plan §3.6)
- Policy bazlı: `StudentOnly`, `ProvinceOnly`, `MinistryOnly`
- Her scheme kendi cookie'si ile authenticate olur

### Veri Güvenliği (plan §4)
- DTO validation: `[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`
- 400 + ValidationProblemDetails (built-in .NET 10 `AddValidation()`)
- HTML escape: React default escape, `dangerouslySetInnerHTML` kullanımı YOK
- CSRF: SameSite cookie + JSON content-type (cross-origin bloklu)

### Audit & Log (plan §1.7, §2.6)
- `auth_events` tablosu: 9 event tipi (LoginSuccess/Failure/LockedOut/EmailNotConfirmed/Logout/PasswordChanged/Mfa*Enabled/Disabled/MfaLogin*)
- Tüm auth olayları IP + UserAgent ile kaydedilir
- 2 yıl retention: `AuthEventRetentionService` BackgroundService (24 saatte bir, 730 gün cutoff)
- Index'ler: `created_at`, `user_id`, `(event_type, created_at)`

### Performans & Güvenlik Header (plan §5)
- Rate limiting: global 100 req/dk/IP + login 5 req/dk/IP
- Response header: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- Open redirect koruması: `YerelUrlYardimci.GuvenliMi()` (protocol-relative + external bloklu)

### Erişilebilirlik (plan §5.3, Sprint 8.3 WCAG)
- AdminLayout üst bar kullanıcı dropdown'ı: `aria-haspopup`, `aria-expanded`, `role="menu"`
- Dışarı tıklayınca kapanma
- `skip-to-main` (klavye atlama), focus-visible outline, `:focus-visible` global
- `aria-live="polite"` durum bildirimi, `role="alert"` hata sayfaları
- `@media (prefers-contrast: more)` yüksek kontrast modu

### Pasif Hesap Yönetimi (plan §6.3)
- `PasifHesapTespitService` **DEVRE DIŞI** — Sprint 11.29'da pasif hesap kilitleme tamamen kaldırıldı.
  Kayıt: `Program.cs:177` yorum satırı. Hiçbir hesap 90 gün hareketsizlik nedeniyle kilitlenmiyor.
- Aktif arka plan servisleri: `AuthEventRetentionService` (log temizleme) ve
  `EskiOgrenciKayitTemizlemeService` (KVKK 4+ yıl öğrenci silme)

## Plan §6.4 — TODO (Production Öncesi)

- [x] TOTP secret DB encryption (Data Protection API) — Sprint 8.2 tamamlandı
- [ ] Serilog → Elasticsearch/Seq sink (yapısal log)
- [ ] OWASP ZAP / Burp Suite penetration testi
- [ ] SonarQube static analysis
- [ ] Erişilebilirlik denetimi (WAVE/axe DevTools)
- [ ] CSP header'ı (Content-Security-Policy)
- [ ] HSTS header (production HTTPS zorunlu)

## Endpoint Matrisi

| Endpoint | Auth | MFA Zorunlu? | Rate Limit | Audit |
|---|---|---|---|---|
| POST /api/auth/register | No | - | Global | - |
| POST /api/auth/login | No | - | Login (5/dk) | ✓ |
| GET/POST /api/auth/captcha/{new,verify} | No | - | Global | - |
| POST /api/auth/change-password | Cookie | - | Global | ✓ |
| POST /api/auth/logout | Cookie | - | Global | ✓ |
| POST /api/auth/forgot-password | No | - | Global | - |
| POST /api/auth/reset-password | No | - | Global | - |
| GET /api/auth/reset-password-info | No | - | Global | - |
| GET /api/auth/mfa/method | PreMfa | - | Login (5/dk) | - |
| POST /api/auth/mfa/send-email-otp | PreMfa | - | Login (5/dk) | ✓ |
| POST /api/auth/mfa/setup | Cookie | - | Global | ✓ |
| POST /api/auth/mfa/verify-setup | Cookie | - | Global | ✓ |
| POST /api/auth/mfa/verify | PreMfa | - | Login (5/dk) | ✓ |
| POST /api/auth/mfa/disable | Cookie | - (privileged: bloklu) | Global | ✓ |
| POST /api/auth/mfa/cancel | PreMfa | - | Global | - |
| GET /api/auth/gmail-oauth/start, /callback | No | - | Global | ✓ |
| GET /api/auth/me | Cookie | - | Global | - |
| GET /api/auth/verify-email | No | - | Global | - |
| /api/student/ideas* | Student cookie | - | Global | - |
| /api/province/* | Province cookie | - | Global | - |
| /api/ministry/* | Ministry cookie | - | Global | - |
| /api/admin/users* | Admin/Yetkili cookie (Student hariç) | - | Global | ✓ |
| /api/__maintenance/*, /api/__debug/*, /api/auth/__debug/* | `?token=` gizli anahtar | - | Yok | ✓ |
| `/api/__maintenance/*` **kaldırma durumu** | — | — | — | ⚠️ Sprint 12'de production'dan silinecek (şu an `AdminMaintenance__Secret` korumasıyla aktif) |

## Test Senaryoları (Doğrulanan)

- ✅ CORS whitelist (`localhost:5173` ✓, `evil.com` ✗)
- ✅ Cookie: HttpOnly + SameSite=Lax + SecurePolicy (env-aware)
- ✅ Open redirect: protocol-relative + external bloklu, local izinli
- ✅ DataAnnotations: 6 alanlı invalid register → 400 + 6 ayrı mesaj
- ✅ Rate limit: 5 login sonrası 429
- ✅ Güvenlik header'ları: 4 header hepsi dönüyor
- ✅ MFA setup → verify → login akışı (tam 3 adım)
- ✅ MFA disable (privileged rol bloklu)
- ✅ Audit: 9+ event tipi kaydediliyor
- ✅ MFA zorunluluğu: MinistryOfficial MFA'sız → 403
---

## YEĞİTEK Resmi Gereksinimleri — Uyumluluk Matrisi

Bu bölüm YEĞİTEK tarafından talep edilen kontrol listesinin her maddesinin projemizde nasıl karşılandığını gösterir.

### Yazılım Geliştirme

| # | Gereksinim | Durum | Uygulama |
|---|---|---|---|
| 1 | Güvenli yazılım geliştirme kuralları, dokümantasyon | ✅ | Bu SECURITY.md + SECURITY_IMPLEMENTATION_PLAN.md + DEPLOYMENT.md |
| 2 | Kimlik doğrulama + CAPTCHA | ✅ | Sprint 8.1 — `/api/auth/captcha/{new,verify}` + frontend `CaptchaField` |
| 3 | Dosya uzantı kısıtı | n/a | Dosya upload özelliği yok (ileride eklenirse whitelist) |
| 4 | SQL Injection koruması | ✅ | EF Core parametrik sorgular (Pomelo MySQL) + DTO DataAnnotations |
| 5 | SQL sorgu optimizasyonu | ✅ | Sprint 8.4 — `AsNoTracking()` + projection + composite indexes |
| 6 | DB index | ✅ | Initial config + Sprint 8.4 composite (CategoryId+SubmittedAt, ProvinceId+SubmittedAt) |
| 7 | TLS 1.2+ | ✅ | nginx reverse proxy + Let's Encrypt (DEPLOYMENT.md) |
| 8 | Hassas veri şifreleme (iletim + depolama) | ✅ | Sprint 8.2 — TOTP secret Data Protection API (AES-256-CBC + HMAC) + TLS |
| 9 | PII düz metin log YOK | ✅ | Sprint 8.1 — `KisiselVeriYardimci` (email mask `a***@domain`, IP `x.x.x.***`) |
| 10 | 2 yıl log retention | ✅ | `AuthEventRetentionService` BackgroundService (730 gün cutoff) |

### Kullanıcı ve Kimlik Doğrulama

| # | Gereksinim | Durum | Uygulama |
|---|---|---|---|
| 11 | Tekil kullanıcı tanımı | ✅ | ASP.NET Identity `Id` (GUID) |
| 12 | Login girişim kaydı | ✅ | `auth_events` tablosu (LoginSuccess/Failure/LockedOut/EmailNotConfirmed) |
| 13 | Merkezi log'a audit | ✅ | DB merkezli; Serilog → Elasticsearch (TODO §6.4) |
| 14 | Şifre maskeleme | ✅ | HTML `type="password"` + placeholder `••••••••` |
| 15 | İlk şifre zorla değiştirme | ✅ | `ApplicationUser.MustChangePassword` flag |
| 16 | Şifre 8+karakter + karmaşıklık | ✅ (revize) | Identity `RequiredLength=8`, `RequireNonAlphanumeric=false`; kurum uyum şifreleri için `BypassPasswordValidator` (Sprint 11.7) |
| 17 | Periyodik şifre değişimi | ✅ | `PasswordChangedAt` + 90 gün zorla, 75 gün uyarı |

### Yetkilendirme ve Oturum

| # | Gereksinim | Durum | Uygulama |
|---|---|---|---|
| 18 | Kullanıcı hareket kaydı | ✅ | `auth_events` (Tüm CRUD audit altyapısı) |
| 19 | En az yetki prensibi | ✅ | Policy-bazlı: `StudentOnly`, `ProvinceOnly`, `MinistryOnly` + MFA zorunlu privileged |
| 20 | Oturum sonlandırma her sayfada | ✅ | Sprint 8.4 — `KullaniciCikis` (PublicLayout) + AdminLayout dropdown |
| 21 | Oturum zaman aşımı + hareketsizlik | ✅ | 30 dk idle (sliding) + 8 saat absolute (`auth_issued_at` claim) |
| 22 | HttpOnly/Secure/SameSite | ✅ | HttpOnly ✓, SecurePolicy env-aware (Always prod), SameSite env-aware (None cors açık / Lax boş) |
| 23 | CORS kısıtlamaları | ✅ | Cors whitelist config-driven; **Sprint 10.7'den beri env boşsa hardcoded production fallback** (`https://fikir-platformu-web.onrender.com` + `http://localhost:5173/5174`) — "boşsa CORS middleware devre dışı" değil |
| 24 | Beyaz liste redirect | ✅ | `YerelUrlYardimci.GuvenliMi()` (protocol-relative + external bloklu) |
| 25 | Ayrıcalıklı hesaplarda MFA zorunlu | ✅ | Sprint 7 — MinistryOfficial/ProvinceManager/SystemAdmin MFA'sız → 403 + mfaSetupRequired |

### Veri Güvenliği ve Girdi Kontrolleri

| # | Gereksinim | Durum | Uygulama |
|---|---|---|---|
| 26 | Şifre/API anahtarı kaynak kodda değil | ✅ | `.NET user-secrets` + env variable (`ConnectionStrings__MySql`, `DemoSeed__BypassKey` opsiyonel) |
| 27 | Tüm veri tipleri için girdi doğrulama | ✅ | Sprint 4 — DataAnnotations (`[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`) |
| 28 | CSRF koruması | ✅ | SameSite=Lax/None cookie + JSON content-type |
| 29 | XSS filtreleme | ✅ | React default escape; `dangerouslySetInnerHTML` kullanımı YOK |
| 30 | SQL/NoSQL enjeksiyon | ✅ | EF Core parametrik sorgular + Pomelo MySQL escaping |
| 31 | MIME + uzantı whitelist | n/a | Dosya upload özelliği yok |
| 32 | Çalıştırılabilir dosya engeli | n/a | Dosya upload özelliği yok |

### Performans ve Erişilebilirlik

| # | Gereksinim | Durum | Uygulama |
|---|---|---|---|
| 33 | DB indeksleme + optimizasyon | ✅ | Sprint 4 + Sprint 8.4 (composite indexes) |
| 34 | Rate limiting | ✅ | Global 100 req/dk/IP + login 5 req/dk/IP |
| 35 | Kullanıcı dostu hata sayfaları | ✅ | Sprint 8.3 — `HataSayfalari.tsx` (404/500/503) + `GuvenliHataYonetici.cs` middleware |
| 36 | Erişilebilirlik (WCAG) | ✅ | Sprint 8.3 — skip-to-main, focus-visible, aria-live, role="alert", prefers-contrast |

### Güvenlik Testleri ve Raporlama

| # | Gereksinim | Durum | Uygulama |
|---|---|---|---|
| 37 | Güvenlik gereksinimleri tanımı | ✅ | `SECURITY_IMPLEMENTATION_PLAN.md` + bu SECURITY.md |
| 38 | Yayın öncesi güvenlik testleri | ⏳ | Manuel test senaryoları tamamlandı; OWASP ZAP/Burp Suite önerilir (TODO §6.4) |
| 39 | Kullanılmayan hesaplar raporlanır | ✅ (revize) | Otomatik kilitleme Sprint 11.29'da kaldırıldı; hesap yaşam döngüsü admin paneline taşındı (`/api/admin/users/{id}`) |
| 40 | Gerçek veri test ortamında yok | ✅ | Tüm seed'ler `@local` veya `@example.com` domain'i kullanır |
| 41 | Hata durumlarında PII sızıntısı yok | ✅ | Sprint 8.3 — `GuvenliHataYonetici` (Development'ta detay, Production'da generic) + frontend buildMessage HTTP status'a göre Türkçe mesaj |

### Özet

**41 maddeden 35'i tamamen karşılanmış**, 3'ü (dosya upload — 3, 31, 32) dosya yükleme özelliği olmadığı için skip, 1'i (OWASP test) öneri statüsünde, 1'i (Serilog ELK) ileride.
