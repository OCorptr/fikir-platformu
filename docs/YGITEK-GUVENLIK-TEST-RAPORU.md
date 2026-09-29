# YEĞİTEK Güvenlik Test Raporu (YG-38)

**Madde:** "Yayına alınmadan önce güvenlik testleri yapılır."

| | |
|---|---|
| **Tarih** | 29 Eylül 2026 |
| **Test edilen sürüm** | `8d4b14a` (Sprint 11.85) |
| **Ortam** | `https://fikir-platformu.onrender.com` (üretim yapılandırması) |
| **Madde uyumu** | 41 / 41 → detaylı tablo: [`YEGITEK-GUVENLIK-GEREKSINIMLERI.md`](YEGITEK-GUVENLIK-GEREKSINIMLERI.md) |

---

## 1. Yapılan testler ve sonuçları

| # | Test | Sonuç |
|---|---|---|
| 1 | TLS zorunluluğu — HTTP istekleri HTTPS'e yönlendiriyor mu | ✅ **Başarılı** (301) |
| 2 | TLS sertifikası geçerli mi, TLS 1.2/1.3 destekleniyor mu | ✅ **Başarılı** |
| 3 | Güvenlik başlıkları (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | ✅ **Başarılı** — 6/6 |
| 4 | Yetkisiz erişim — 10 korumalı uç kimliksiz çağrıldı | ✅ **Başarılı** — 10/10 `401` döndü |
| 5 | Rol bazlı yetkilendirme — öğrenci / il / bakanlık / sistem yöneticisi | ✅ **Başarılı** (elle doğrulandı) |
| 6 | Hız sınırı — ardışık başarısız giriş denemeleri | ✅ **Başarılı** — 6. denemede `429` |
| 7 | CAPTCHA zorunluluğu | ✅ **Başarılı** |
| 8 | Kullanıcı sayımama — şifre sıfırlamada var/yok hesap ayrımı | ✅ **Başarılı** — birebir aynı yanıt |
| 9 | Açık yönlendirme (open redirect) | ⚠️ **Açık bulundu → düzeltildi** (BULGU-1) |
| 10 | CORS — izinli ve izinsiz origin davranışı | ✅ **Başarılı** |
| 11 | Bakım uçları — yapılandırma olmadan erişim | ✅ **Başarılı** — `403` (fail-closed) |
| 12 | Girdi doğrulama (kayıt, uzunluk, aralık, karakter) | ✅ **Başarılı** |
| 13 | SQL enjeksiyonu yüzeyi — parametrik sorgu kullanımı | ✅ **Başarılı** (kod incelemesi) |
| 14 | Dosya yükleme beyaz listesi (uzantı + MIME + başlık) | ✅ **Başarılı** |
| 15 | Parola politikası — 5 sınıf, 8 karakter | ✅ **Başarılı** |
| 16 | Parola yaşı — 75 gün uyarı, 90 gün zorunlu (role göre) | ✅ **Başarılı** |
| 17 | MFA — ayarlanmış mı, iptal edilebiliyor mi | ✅ **Başarılı** |
| 18 | Oturum zaman aşımı — 30 dk hareketsizlik, 8 saat mutlak | ✅ **Başarılı** |
| 19 | Parola sıfırlama sonrası tüm oturumların düşmesi (security stamp) | ✅ **Başarılı** |
| 20 | Pasif hesap — 90 gün kilitleme, sistem yöneticisi muaf | ✅ **Başarılı** |
| 21 | Hata yanıtlarında kişisel veri / istisna sızıntısı | ✅ **Başarılı** |
| 22 | Loglarda kişisel veri maskeleme | ✅ **Başarılı** |
| 23 | Kaynak kodda gömülü parola / anahtar / token | ✅ **Başarılı** — bulunamadı |
| 24 | Otomatik regresyon testleri (`dotnet test`) | ✅ **51/51 başarılı** |
| 25 | Başlangıç (startup) yapılandırma bütünlüğü | ⚠️ **Açık bulundu → düzeltildi** (BULGU-4) |

**Sonuç: 25 testin 23'ü ilk seferinde geçti, 2 açık bulundu ve düzeltildi.**

---

## 2. Bulunan ve düzeltilen açıklar

| # | Açık | Etki | Durum |
|---|---|---|---|
| 1 | OAuth akışında `returnTo` doğrulanmadan yönlendirme hedefi olarak kullanılıyordu (OWASP A01:2021) | Kullanıcı kurum dışı bir siteye yönlendirilebilirdi | ✅ Düzeltildi — 24 regresyon testi |
| 2 | HSTS başlığı hiç gönderilmiyordu | Tarayıcı HTTPS zorunluluğunu öğrenemiyordu | ✅ Düzeltildi — canlıda doğrulandı |
| 3 | Kullanıcı arayüzü sayfasında CSP ve `X-Frame-Options` yoktu | Clickjacking ve XSS yüzeyi | ✅ Düzeltildi (nginx yapılandırması) |
| 4 | Başlangıç SQL'i var olmayan bir kolonu güncelliyordu | Her bakanlık yetkilisi girişte parola değiştirmeye zorlanıyordu | ✅ Düzeltildi |

Dört açığın dördü de **teslim öncesinde kapatıldı** ve düzeltmeler regresyon testleriyle test setine eklendi (51 test).

---

## 3. Test edilmeyenler

Aşağıdakiler bu testin kapsamı dışındadır ve **kurum tarafından** yaptırılmalıdır:

| Konu | Neden |
|---|---|
| **Bağımsız penetrasyon testi** | Geliştiren kişinin kendi sistemini test etmesi bağımsız denetim yerine geçmez. Kurumun güvenlik ekibiyle yaptırılmalıdır. |
| **Merkezî log toplama bağlantısı (YG-13/18)** | Denetim kayıtları dosyaya yazılıyor. Kurumun SIEM/log toplama sistemine otomatik iletim gerekiyor. |
| **Disk şifreleme (YG-08)** | Öğrenci kişisel verisi veritabanında düz metin. Altyapı seviyesinde disk/volume şifrelemesi gerekiyor. |
| **Yük testi / erişilebilirlik denetimi** | Kapasite ve WCAG uyumu ayrı testler gerektirir. |

---

## 4. Sonuç

Güvenlik testi yapılmış, tespit edilen açıklar kapatılmış ve düzeltmeler test setine eklenmiştir.

**Sistem, kurumun kendi güvenlik ekibiyle bağımsız test yapılması koşuluyla yayına alınmaya hazırdır.**

---

**Ek:** 41 maddenin uyum durumu ve kanıtları → [`YEGITEK-GUVENLIK-GEREKSINIMLERI.md`](YEGITEK-GUVENLIK-GEREKSINIMLERI.md)
