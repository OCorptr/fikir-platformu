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
| 7 | MFA zorunluluğu (privileged roles) + pasif hesap tespiti | ✅ | (bu commit) |

## Uygulanan Kontroller

### Kimlik Doğrulama (plan §2)
- Şifre politikası: min 8 karakter, büyük/küçük/raam/özel, 4 unique karakter (Identity)
- Lockout: 5 başarısız deneme → 15 dk (Identity)
- Şifre süre sonu: 90 gün zorla, 75 gün uyarı (frontend `passwordWarn` flag'i)
- MFA: TOTP (RFC 6238), Otp.NET 1.4.1
  - Ayrıcalıklı roller (MinistryOfficial, ProvinceManager, SystemAdmin) için **zorunlu**
  - Diğer kullanıcılar opt-in
  - Secret DB'de plain base32; production'da Data Protection API ile şifrelenmeli (TODO §6.4)

### Oturum Yönetimi (plan §3)
- Cookie: HttpOnly ✓, SameSite=Lax ✓
- SecurePolicy: Development HTTP=SameAsRequest, Production HTTPS=Always
- Idle timeout: 30 dk sliding
- Absolute timeout: 8 saat (`auth_issued_at` claim + OnValidatePrincipal reject)
- 3 ayrı cookie scheme (öğrenci/il/bakanlık — aynı tarayıcıda çoklu oturum)

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

### Erişilebilirlik (plan §5.3)
- AdminLayout üst bar kullanıcı dropdown'ı: `aria-haspopup`, `aria-expanded`, `role="menu"`
- Dışarı tıklayınca kapanma

### Pasif Hesap Yönetimi (plan §6.3)
- `PasifHesapTespitService`: 30 günde bir, 90 gün login olmamış hesaplar LockoutEnd=MaxValue

## Plan §6.4 — TODO (Production Öncesi)

- [ ] TOTP secret DB encryption (Data Protection API)
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
| POST /api/auth/change-password | Cookie | - | Global | ✓ |
| POST /api/auth/logout | Cookie | - | Global | ✓ |
| POST /api/auth/forgot-password | No | - | Global | - |
| POST /api/auth/reset-password | No | - | Global | - |
| POST /api/auth/mfa/setup | Cookie | - | Global | ✓ |
| POST /api/auth/mfa/verify-setup | Cookie | - | Global | ✓ |
| POST /api/auth/mfa/login | No | - | Login (5/dk) | ✓ |
| POST /api/auth/mfa/disable | Cookie | - (privileged: bloklu) | Global | ✓ |
| GET /api/auth/me | Cookie | - | Global | - |
| GET /api/auth/verify-email | No | - | Global | - |

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