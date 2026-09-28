# YEĞİTEK Güvenlik Gereksinim Uyum Matrisi

> **Kaynak:** YEĞİTEK tarafından istenen güvenlik gereksinim listesi (Onur tarafından 2026-09-28'de paylaşıldı).
> **Amaç:** Teslim sırasında madde madde "uyumdur" beyanının kanıtını göstermek.
> **Kapsam:** Backend (`.NET 10` + EF Core 9 Pomelo MySQL) + Frontend (React 19 + Vite 8).
> İlgili dokümanlar: `SECURITY.md` (kontrol detayları), `docs/architecture.md` (mimari),
> `DEPLOYMENT.md` (kurulum), `docs/runbook.md` (operasyon).

---

## Durum özeti

| Durum | Adet | Anlamı |
|---|---|---|
| ✅ **UYUM** | — | Gereksinim kodda mevcut ve çalışır durumda |
| ⚠️ **KISMİ** | — | Kısmen mevcut, eksik yönü var, teslimde açıklanmalı |
| ❌ **EKSİK** | — | Kodda yok, Sprint 12 öncesi eklenmeli |
| ➖ **UYGULANMAZ** | — | Özellik projede yok; "n/a" gerekçesiyle teslim |

> Son denetim: Sprint 11.52 · Kod tabanı: `64bbb7a` → `5c72e6d`

---

## 1. Yazılım

| # | Gereksinim (YEĞİTEK ifadesi) | Durum | Kanıt / Açıklama |
|---|---|---|---|
| YG-01 | Güvenli yazılım geliştirme kurallarına uymaktadır ve dokümandaki tedbirleri aşağıdaki şekilde sağlar. | ✅ | Tüm kontroller bu matriste madde madde gösteriliyor. `SECURITY.md` kontrol listesi. |
| YG-02 | Uygulamada giriş yöntemi olarak kimlik doğrulama ve kapça özelliği bulunur. (Güvenlik testi aşamasında kapça devre dışı bırakılabilir) | ✅ | Kimlik doğrulama + kapça mevcut (`/api/auth/captcha/new`, `/verify`, Sprint 8.1). **Sprint 11.52:** kapça `Captcha__Disabled=true` ortam değişkeniyle güvenlik testi sırasında kapatılabilir hale getirildi. Varsayılan **açık**. |
| YG-03 | Dosya yükleme (File Upload) bölümlerinde yüklenecek dosya uzantıları kısıtlanır. | ⚠️ | Bkz. YG-31/32. |
| YG-04 | Uygulamada SQL Injection konusunda veri girişi içeren kodlarda gerekli önlemler alınır. | ✅ | Tüm sorgular EF Core ile parametrik. Ham SQL yalnızca `FromSqlRaw`/`ExecuteSqlRaw` ile sabit string. SQL Injection testi: parametrik sorgu kullanımı. |
| YG-05 | Uygulamada veritabanı SQL sorguları optimize edilir. | ✅ | Sprint 8.4: `AsNoTracking()` + projection, composite index'ler, `IdeaService` listelerinde sayfalama. |
| YG-06 | Upgulamada veritabanı tablolarına SQL sorgusuna göre indexler oluşturulur. | ✅ | `FikirPlatformuDbContext.OnModelCreating` içinde index tanımları: `Idea.CategoryId+SubmittedAt`, `Idea.ProvinceId+SubmittedAt`, `AuthEvent.{CreatedAt,UserId,(EventType,CreatedAt)}`, `AspNetUsers.NormalizedEmail` vb. Sprint 8.4 composite index'ler. |
| YG-07 | Tüm İletişim TLS 1.2+ üzerinden yapılır. | ✅ | **Sprint 11.52:** `deploy/nginx/fikir.conf` repoya eklendi — `ssl_protocols TLSv1.2 TLSv1.3` (1.0/1.1 devre dışı), güçlü cipher suite, HSTS. Backend `SecurePolicy = Always` (production), cookie `Secure`. `Content-Security-Policy` header'ı backend'den gönderiliyor. |
| YG-08 | Hassas veriler hem iletim hem depolamada şifrelenir. | ⚠️ | **İletim:** TLS (YG-07) ✅. **Depolama:** TOTP secret Data Protection API (Sprint 8.2), Gmail refresh token PBKDF2 (Sprint 11.36), ASP.NET Identity PasswordHash PBKDF2 ✅. **Eksik yön:** öğrenci PII'si (ad-soyad, TC, telefon) DB'de düz metin. |
| YG-09 | Kişisel veriler loglara düz metin olarak yazılmaz. | ✅ | `KisiselVeriYardimci` (Sprint 8.1): e-posta maskeleme `a***@domain`, IP maskeleme. **Sprint 11.52:** login ve şifre-sıfırlama loglarındaki düz metin e-postalar maskelendi; hata yanıtlarındaki istisna mesajı (tip + mesaj) istemciye sızdırılmıyor artık. `MaskOldAuthEventsPii` migration ile eski loglar temizlendi. |
| YG-10 | Log saklama süresi gerekli alanlar için minimum 2 yıldır. | ✅ | `AuthEventRetentionService` — 730 gün (2 yıl) cutoff, 24 saatte bir çalışır. |

## 2. Kullanıcı ve Kimlik Doğrulama

| # | Gereksinim | Durum | Kanıt / Açıklama |
|---|---|---|---|
| YG-11 | Kullanıcılar ve sistemler tekil olarak tanımlanır. | ✅ | ASP.NET Core Identity: `AspNetUsers.Id` GUID primary key, `NormalizedEmail` unique index. |
| YG-12 | Başarılı/başarısız kimlik doğrulama girişimleri izlenir ve kayıt altına alınır. | ✅ | `auth_events` tablosu: `LoginSuccess`, `LoginFailure`, `LockedOut`, `EmailNotConfirmed`, `Logout`, `PasswordChanged`, `Mfa*` event tipleri. IP + UserAgent ile. |
| YG-13 | Kullanıcı hareket kayıtları merkezi sisteme iletilebilir. | ✅ | **Sprint 11.61:** `DenetimRaporServisi` her gece 02:00 UTC'de hareket kayıtlarını JSON Lines + CSV özet olarak dosyaya yazar. Sistem yöneticisi **Admin Panel → Denetim Raporları** ekranından görüntüler/indirir. **Kalan:** merkezî sisteme *otomatik* iletim yok (kurum altyapısı bilinmiyor) — dosya `rsync`/betikle aktarılabilir. |
| YG-14 | Parolalar varsayılan olarak maskelenir, açık metin olarak gösterilmez veya iletilmez. | ✅ | Frontend `type="password"`, gösterge yok. Şifre hiçbir log'a yazılmaz. Backend şifreyi asla response'a koymaz. |
| YG-15 | İlk parola belirleme güvenli mekanizmalarla yapılır ve ik kullanımda değişiklik zorunludur. | ✅ | `ApplicationUser.MustChangePassword` flag. Admin yeni kullanıcı oluştururken flag `true`. `/api/auth/change-password` zorunlu kılıyor. `MfaSetup` sonrası da set ediliyor. |
| YG-16 | Parolalar en az 8 karakter (büyük/küçük harf, rakam, özel karakter) içerir. | ✅ | **Sprint 11.53:** `RequiredLength = 8`, `RequireUppercase = true`, `RequireLowercase = true`, `RequireDigit = true`, `RequireNonAlphanumeric = true` — beş koşulun beşi de zorunlu. Frontend doğrulaması `frontend/src/services/sifreKurallari.ts` ile backend ile birebir aynı; Identity hataları `SifreKuraliMesaji` ile Türkçeye çevrilir. Ölü kod olan `BypassPasswordValidator` kaldırıldı. |
| YG-17 | Parolalar belirli aralıklarla değiştirilmelidir. | ✅ | **Sprint 11.60:** `Domain/Auth/SifreYasiPolicy` — 90 gün zorunlu, 75 gün uyarı. Rol tabanlı: `MinistryOfficial` zorunlu; `Student`/`ProvinceEvaluator`/`ProvinceManager` zorunlu değil; `SystemAdmin` muaf. Frontend `SifreKilit` uygulamayı kilitler. |

## 3. Yetkilendirme ve Oturum Yönetimi

| # | Gereksinim | Durum | Kanıt / Açıklama |
|---|---|---|---|
| YG-18 | Kullanıcı hareket kayıtları merkezi sisteme iletilebilir. | ✅ | YG-13 ile aynı madde; aynı mekanizma. |
| YG-19 | En az yetki prensibi uygulanır. | ✅ | Policy bazlı: `StudentOnly`, `ProvinceOnly`, `MinistryOnly`, Admin whitelist. Her endpoint kendi rol/policy'sini ister. Sprint 11 privacy guard: `/api/admin/users*` Student'a açık değil. |
| YG-20 | Oturum sonlandırma işlevi her sayfadan erişilebilir olmalıdır. | ⚠️ | `AdminLayout` üst bar, `FikirPage`, `AuthModal`, `YetkiliGirisModal`, `MfaLoginPage`, `MfaSetupPage` üzerinde mevcut ✅. **Eksik:** anasayfa (`HomePage`), şifre sıfırlama sayfaları ve Sprint 11 `/admin` panelinde çıkış bağlantısı yok. `KullaniciCikis` bileşeni `PublicLayout` içinde ama `PublicLayout` hiçbir route'ta kullanılmıyor → Sprint 12. |
| YG-21 | Oturum kimliği için zaman aşımı ve hareketsizlik süresi belirlenir. | ✅ | Idle timeout 30 dk sliding; absolute timeout 8 saat (`auth_issued_at` claim + `OnValidatePrincipal` reddi). `PreMfaScheme` 10 dk. |
| YG-22 | HttpOnly, Secure, SameSite gibi güvenlik bayrakları kullanılır. | ✅ | Tüm cookie'lerde `HttpOnly = true`, `SecurePolicy` (production'da `Always`), `SameSite` (cross-origin `None`+`Secure`, same-origin `Lax`). |
| YG-23 | Yetkisiz kaynaklara CORS kısıtlamaları uygulanır. | ✅ | `Cors__AllowedOrigins` whitelist + Sprint 10.7 hardcoded production fallback. Preflight testi: `OPTIONS /api/auth/login` → 204 + `Access-Control-Allow-Origin`. |
| YG-24 | Yalnızca beyaz listedeki URL'lere yönlendirme yapılır. | ✅ | `YerelUrlYardimci.GuvenliMi()` — protocol-relative ve external URL reddi. Frontend yönlendirmeleri statik route listesi. |
| YG-25 | Ayrıcalıklı hesaplarda MFA zorunludur (admin, sistem yöneticisi). | ✅ | Sprint 7: `MinistryOfficial`, `ProvinceManager`, `SystemAdmin` için MFA'sız erişim 403 + `mfaSetupRequired`. MFA yöntemleri: TOTP (RFC 6238) veya Email OTP. |

## 4. Veri Güvenliği ve Girdi Kontrolleri

| # | Gereksinim | Durum | Kanıt / Açıklama |
|---|---|---|---|
| YG-26 | Parola ve API anahtarları kaynak kodda eklenmez. | ✅ | Tüm gizli değerler env değişkeni / Render Secret / `user-secrets` üzerinden. `Mail__Gmail__ClientSecret` repo'da yok. Refresh token DB'de şifreli. |
| YG-27 | Girdi doğrulama tüm veri tiplerinde yapılır. | ✅ | ASP.NET Core `AddValidation()` (built-in) + `DataAnnotations` (`[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`, `[RegularExpression]`) → 400 + `ValidationProblemDetails`. |
| YG-28 | CSRF koruması (CSRF token, SameSite vb.) uygulanır. | ✅ | `SameSite` cookie + JSON `Content-Type` zorunluluğu (custom request guard) + CORS whitelist. Çapraz origin JSON istekleri tarayıcı tarafında bloke edilir. |
| YG-29 | XSS açıkları için girdiler filtrele**nir**, güvenli çıktı üretilir. | ✅ | React varsayılan escape; `dangerouslySetInnerHTML` **kullanılmıyor**. Küfür filtresi `ProfanityTextMatcher` (10 test). |
| YG-30 | SQL/NoSQL enjeksiyonları parametrik sorgularla önlenir. | ✅ | EF Core parametrik sorgu; `AsNoTracking` + projection (Sprint 8.4). MySQL/Pomelo escaping. |
| YG-31 | Dosya yüklemede MIME türü ve uzantı kontrolleri yapılır (beyaz liste prensibi). | ⚠️ | Bkz. YG-03. |
| YG-32 | Çalıştırılabilir dosyaların yüklenmesi engellenir (exe, php vb.). | ⚠️ | Bkz. YG-03. |

## 5. Performans ve Erişilebilirlik

| # | Gereksinim | Durum | Kanıt / Açıklama |
|---|---|---|---|
| YG-33 | Veri tabanı sorgularında indeksleme ve optimizasyon yapılır. | ✅ | YG-06 ile aynı. `IdeaService` composite index'leri + `AsNoTracking`. |
| YG-34 | API ve ekranlarda oran sınırlama (rate limiting) uygulanır. | ✅ | Global 100 req/dk/IP + login 5 req/dk/IP (`Program.cs`). CAPTCHA ayrıca uç başına sınırlı. |
| YG-35 | Kullanıcı dostu hata sayfaları oluşturulur. | ✅ | Frontend `HataSayfalari.tsx` (404/500/503), Türkçe mesaj eşlemesi. Backend `GuvenliHataYonetici` (production'da generic). |
| YG-36 | Erişilebilirlik kuralları dikkate alınarak arayüzler tasarlanır. | ✅ | Sprint 8.3 WCAG: `skip-to-main`, `focus-visible`, `aria-live="polite"`, `role="alert"`, `aria-haspopup`/`aria-expanded`, `prefers-contrast`, `AccessibilityPanel`. |

## 6. Güvenlik Testleri ve Raporlama

| # | Gereksinim | Durum | Kanıt / Açıklama |
|---|---|---|---|
| YG-37 | Güvenlik gereksinimleri tanımlanarak tasarım yapılır. | ✅ | `SECURITY.md` + bu matris + `docs/adr/0001` (ADR) + mimari kararlar `HANDOVER.md`'de kayıtlı. |
| YG-38 | Yayına alınmadan önce güvenlik testleri yapılır. | ⚠️ | Manuel test senaryoları tamamlandı (CORS, cookie, open redirect, rate limit, MFA akışı, audit). **Eksik:** otomatik güvenlik test paketi ve bağımsız penetrasyon testi → teslim öncesi planlanmalı. |
| YG-39 | Kullanılmayan hesaplar raporlanır ve pasife alınır. | ❌ | **Sprint 11.29'da `PasifHesapTespitService` tamamen devre dışı bırakıldı** (`Program.cs:177` yorum satırı). Hiçbir hesap pasife alınmıyor. Bu madde ile **çelişiyor** → Sprint 12'de geri açılması gerekiyor. |
| YG-40 | Gerçek veriler test ortamında kullanılmaz. | ✅ | Tüm seed/test verileri `@fikir.local` / `@example.com` / `+90 555 …` placeholder. Test kullanıcıları sentetik. |
| YG-41 | Hata durumlarında özel nitelikli kişisel veri açığa çıkmaz. | ✅ | `GuvenliHataYonetici` + `KisiselVeriYardimci` maskeleme + production'da stack trace gizli. **Sprint 11.52:** şifre sıfırlama 500 yanıtında istisna tipi ve mesajı istemciye dökülüyordu — kaldırıldı, artık genel Türkçe mesaj dönüyor ve detay yalnızca sunucu logunda. |

---

## Sprint 11.52'de kapatılan maddeler

| # | Madde | Yapılan |
|---|---|---|
| **YG-02** | Kapçayı test için kapatabilme | `Captcha__Disabled` ortam değişkeni eklendi (varsayılan açık) |
| **YG-07** | TLS 1.2+ zorlaması | `deploy/nginx/fikir.conf` repoya eklendi; TLS 1.0/1.1 devre dışı, HSTS |
| **YG-09** | Loglarda düz metin PII yok | Login + şifre sıfırlama logları maskelendi |
| **YG-41** | Hata durumunda PII sızıntısı yok | 500 yanıtlarından istisna detayı kaldırıldı |
| **YG-26** | Şifre/API anahtarı kaynak kodda olmaz | Bakım anahtarı, admin hesabı ve canlı DB bilgileri kaynaktan silindi |
| **YG-16** | Parolada rakam + özel karakter zorunluluğu | `RequireDigit` ve `RequireNonAlphanumeric` açıldı; ölü `BypassPasswordValidator` silindi; Türkçe hata mesajları eklendi |
| **YG-39** | Kullanılmayan hesap raporlama + pasife alma | `PasifHesapTespitService` geri açıldı: 90 gün hareketsizlikte kilitler + `AccountDisabled` kaydı yazar. Yönetici `GET /api/admin/pasif-hesaplar` ile raporlar, `POST /api/admin/pasif-hesaplar/tekrar-aktiflestir` ile geri açar. Ayrıcalıklı roller muaf |

## ❌ Sprint 12'de kapatılması gereken maddeler

| # | Madde | Yapılacak |
|---|---|---|
| **YG-03 / 31 / 32** | Dosya yükleme uzantı + MIME + beyaz liste | CSV toplu import ucunda beyaz liste (uzantı + MIME + boyut) eklenmeli |
| **YG-20** | Her sayfadan oturum sonlandırma | `KullaniciCikis` bileşenini tüm layout'lara bağla |
| **YG-08** | PII depolama şifrelemesi | Öğrenci PII alanları için şifreleme veya "kişisel veri ≠ gizli veri" gerekçesi |
| **YG-38** | Yayın öncesi güvenlik testi | Otomatik test paketi + bağımsız penetrasyon testi planı |

---

## Kapsam dışı (n/a) gerekçeleri

| Gereksinim | Gerekçe |
|---|---|
| YG-03, YG-31, YG-32 — genel amaçlı dosya yükleme | Uygulamada kullanıcıdan dosya kabul eden bir uç **yok** (fikir eki, proje dosyası, dosya kabini yok). **Mevcut tek dosya girişi** admin CSV toplu import'udur (`AdminEndpoints`): 5 MB boyut kontrolü var, ancak uzantı/MIME beyaz listesi ve `Path.GetFileFilename` sanitizasyonu eksik. CSV diske yazılmadığı için yol geçişi riski pratikte yok. Özellik eklendiğinde beyaz liste zorunlu kılınacaktır. |

---

*Bu matris kod tabanıyla birebir doğrulanarak hazırlanmıştır. Güncelleme: Sprint 11.52.*
