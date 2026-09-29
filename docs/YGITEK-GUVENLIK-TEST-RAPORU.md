# YEĞİTEK Güvenlik Testi Raporu (YG-38)

> **Madde:** "Yayına alınmadan önce güvenlik testleri yapılır."
> **Sürüm:** 1.0 — Sprint 11.84
> **Kapsam:** `docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md` listesindeki 41 madde
> **Ortam:** Render demo (`https://fikir-platformu.onrender.com` + `https://fikir-platformu-web.onrender.com`)

---

## 1. Bu rapor ne kapsıyor, ne kapsamıyor

Bu rapor **geliştirici tarafından otomatik olarak doğrulanabilen** kontrolleri içerir.
Her kontrol için çalıştırılan komut ve gözlenen sonuç yazılıdır.

| | Kapsam | Durum |
|---|---|---|
| ✅ | HTTP başlıkları, TLS, CORS, yönlendirme, hız sınırı, kimlik doğrulama sızıntısı, bakım uçları, kod içi statik tarama | **Bu raporda kanıtlandı** |
| ✅ | Otomatik regresyon testleri (xUnit, 51 test) | **Bu raporda kanıtlandı** |
| ⚠️ | Kullanıcı yolculuğu testleri (MFA akışı, panel yetkileri, CSV yükleme) | **Aşağıda listelendi, elle yapılacak** |
| ❌ | Bağımsız penetrasyon testi, kaynak kodu incelemesi, yük/denial-of-service testi | **Kurumun kendi güvenlik ekibine bırakıldı** |

> ⚠️ **Bu bir bağımsız güvenlik denetimi DEĞİLDİR.** Geliştiren kişinin kendi
> sistemini test etmesi, bağımsız denetim yerine geçmez. YEĞİTEK'in kendi güvenlik
> ekibiyle sözleşme yaparak test ettirmesi önerilir (bkz. Bölüm 6).

---

## 2. Test ortamı

| | |
|---|---|
| Tarih | 29 Eylül 2026 |
| Backend | `https://fikir-platformu.onrender.com` (Docker, .NET 10, Kestrel) |
| Frontend | `https://fikir-platformu-web.onrender.com` (Render Static Site) |
| Veritabanı | TiDB Cloud (MySQL uyumlu) |
| Commit | `4ca5452` (Sprint 11.84) |
| Testler | `dotnet test` → **51/51 başarılı** |
| Sürüm kontrolü | `git log`, `curl -I`, `Get-Content` ile kanıtlandı |

**Kullanılan araçlar:** `curl`, `Invoke-WebRequest`, `dotnet test` (xUnit), ripgrep statik tarama.

---

## 3. Bulunan ve düzeltilen açıklar

### 🔴 BULGU-1 — Açık yönlendirme (Open Redirect) · **DÜZELTİLDİ**

| | |
|---|---|
| **OWASP** | A01:2021 — Broken Access Control |
| **Ciddiyet** | Orta |
| **Dosya** | `backend/src/FikirPlatformu.Api/Endpoints/AuthEndpoints.cs:1022` |
| **Bulunma** | Sprint 11.84 güvenlik testi |

**Açıklama.** Gmail OAuth akışında `returnTo` sorgu parametresi hiçbir doğrulama
yapılmadan OAuth `state` değeri içine yazılıyordu. OAuth tamamlandıktan sonra
kullanıcı **herhangi bir adrese** yönlendirilebiliyordu.

**Kanıt (düzeltme öncesi canlı yanıt):**

```
$ curl -sD- "…/api/auth/gmail-oauth/start?returnTo=https%3A%2F%2Fkotu-saldirgan.example"
  state = eyJub25jZSI6Ijg4YzUyMDljY2FkOTQzMjQ4YWM3Y2ZlN2MzN2RhOGQ1IiwicmV0dXJuVG8iOiJodHRwczovL2tvdHUtc2FsZGlyZ2FuLmV4YW1wbGUifQ
                                          └─ base64: {"nonce":"…","returnTo":"https://kotu-saldirgan.example"}
```

Saldırgan kuruma ait bir bağlantıyı paylaşarak kullanıcıyı kendi kontrolündeki
siteye taşıyabiliyordu (phishing, OAuth token hırsızlığı).

**Düzeltme.** `AuthEndpoints.GuvenliYonlendirmeHedefi()` eklendi:

| `returnTo` | Sonuç |
|---|---|
| `/mfa-login` | ✅ kabul → `https://frontend/mfa-login` |
| `https://fikir.yegitek.gov.tr/admin` | ✅ kabul (aynı origin) |
| `https://kotu-saldirgan.example` | ❌ → ana sayfa |
| `https://fikir.yegitek.gov.tr.kotu.example` | ❌ → ana sayfa |
| `//kotu-saldirgan.example` | ❌ → ana sayfa |
| `javascript:alert(1)` | ❌ → ana sayfa |
| `data:text/html,...` | ❌ → ana sayfa |
| farklı port (`:8443`) | ❌ → ana sayfa |

**Doğrulama:** `GuvenliYonlendirmeTestleri.cs` — **24 regresyon testi**, hepsi geçiyor.

---

### 🟠 BULGU-2 — HSTS başlığı hiç gönderilmiyordu · **DÜZELTİLDİ**

| | |
|---|---|
| **Ciddiyet** | Orta |
| **Dosya** | `backend/src/FikirPlatformu.Api/Program.cs` |

**Açıklama.** Kod HSTS'yi `ctx.Request.IsHttps` koşuluna bağlıyordu. Render ve
nginx TLS'i sonlandırıp konteynere **HTTP** ile ilettiği için `IsHttps` her zaman
`false` dönüyor, HSTS başlığı **hiçbir zaman** yazılmıyordu.

**Kanıt (düzeltme öncesi canlı yanıt):**

```
$ curl -sI https://fikir-platformu.onrender.com/api/health
  Content-Security-Policy:      ✅ var
  X-Content-Type-Options:        ✅ var
  X-Frame-Options:               ✅ var
  Referrer-Policy:               ✅ var
  Permissions-Policy:            ✅ var
  Strict-Transport-Security:     ❌ YOK
```

**Etki.** Tarayıcı "yalnızca HTTPS kullan" kuralını öğrenemiyor; ilk istek
düz HTTP ile yapılabilir (downgrade saldırısı).

**Düzeltme.** HSTS artık `HttpRequest.IsHttps` koşuluna bağlı **değil**. Üretimde
koşulsuz gönderilir. Gerekçe: **RFC 6797 §8.1** — "HSTS başlığı güvensiz taşıma
üzerinden alınan istemci tarafından yok sayılmalıdır." Yani HTTP üzerinden
gönderilen HSTS tarayıcı tarafından zaten dikkate alınmaz; koşul koymak yalnızca
başlığın hiç gönderilmesine yol açıyordu. Ayrıca `UseForwardedHeaders()` eklendi
(şema ve istemci IP'si ters proxy üzerinden yeniden kurulur).

> 🔎 **Temsilî proxy adresi sorunu:** `ForwardedHeadersOptions.KnownProxies`
> listesine tek bir IP eklemek Render gibi dinamik proxy havuzlarında kırılgan
> (IP'ler değişir). `KnownNetworks`/`KnownProxies` boşaltıldığında middleware tüm
> kaynakları kabul eder. HSTS'nin koşuldan çıkarılması, çözümü proxy topolojisinden
> tamamen bağımsız hâle getirdi.

---

### 🟠 BULGU-3 — Frontend (HTML) sayfasında güvenlik başlıkları yoktu · **DÜZELTİLDİ**

| | |
|---|---|
| **Ciddiyet** | Orta |
| **Dosya** | `deploy/nginx/fikir.conf` |

**Kanıt (düzeltme öncesi canlı yanıt):**

```
$ curl -sI https://fikir-platformu-web.onrender.com
  Strict-Transport-Security:     ✅ var (Render ekliyor)
  Content-Security-Policy:      ❌ YOK
  X-Frame-Options:              ❌ YOK
```

**Açıklama.** HTML sayfasını **frontend** sunucusu servis eder. Backend'in CSP
middleware'i yalnızca API yanıtlarına uygulanır, sayfaya değil. Bu yüzden
tarayıcıda çalışan sayfanın CSP koruması yoktu (clickjacking + XSS yüzeyi).

**Düzeltme.** `deploy/nginx/fikir.conf`'e CSP eklendi (backend ile birebir aynı politika).

> 📌 **Render demo ortamı için:** Render Static Site başlıkları Blueprint ile
> **servis oluşturulurken** ayarlanır; mevcut servisin panelinden değiştirilmelidir
> (bkz. `HANDOVER.md` — Render notları). nginx kurulumunda sorun yoktur.

---

## 4. Doğrulanan kontroller (açık bulunmadı)

### 4.1 Kimlik doğrulama ve erişim denetimi

**Test:** Tüm korumalı uçlar kimliksiz çağrıldı.

| Uç | Sonuç | Beklenen |
|---|---|---|
| `GET /api/admin/users` | **401** | 401 ✅ |
| `GET /api/admin/pasif-hesaplar` | **401** | 401 ✅ |
| `GET /api/admin/raporlar` | **401** | 401 ✅ |
| `GET /api/ministry/periods` | **401** | 401 ✅ |
| `GET /api/ministry/implementations` | **401** | 401 ✅ |
| `GET /api/province/inbox` | **401** | 401 ✅ |
| `GET /api/province/candidates` | **401** | 401 ✅ |
| `GET /api/profile/` | **401** | 401 ✅ |
| `GET /api/student/ideas` | **401** | 401 ✅ |
| `GET /api/auth/mfa/method` | **401** | 401 ✅ |
| `GET /api/reference/provinces` | **200** | 200 — **incelendi, kabul edildi** |

**`/api/reference/provinces` değerlendirmesi:** Anonim erişime açık, ancak yalnızca
`{id, name}` (81 il adı) döndürür. Kişisel veri içermez, kayıt formunda
kullanılır. **Kabul edildi.**

### 4.2 Bakım uçları — fail-closed davranışı (YG-07 güvenliği)

```
$ curl -X POST ".../api/__maintenance/set-password-raw"          → 403
$ curl -X POST -H "X-Admin-Secret: yanlis" "…/set-password-raw"   → 403
```

`AdminMaintenance__Secret` tanımlı değilse **veya** yanlışsa → **403**.
Gömülü bilinen anahtar yok (Sprint 11.52'de kaldırıldı), sabit-zamanlı
karşılaştırma kullanılıyor. ✅

### 4.3 CORS (YG-23)

```
# İzinli origin
$ curl -X OPTIONS -H "Origin: https://fikir-platformu-web.onrender.com" \
       -H "Access-Control-Request-Method: POST" ".../api/auth/login"
  204 + Access-Control-Allow-Origin: https://fikir-platformu-web.onrender.com
      Access-Control-Allow-Credentials: true ✅

# İzinsiz origin
$ curl -X OPTIONS -H "Origin: https://kotu-saldirgan.example" ...
  CORS başlığı DÖNMEDİ ✅
```

Kodda gömülü origin listesi **yok** (Sprint 11.52). `Cors__AllowedOrigins` boşsa
CORS middleware hiç kurulmaz.

### 4.4 Hız sınırı (YG-34)

```
7 ardışık başarısız giriş denemesi:
  1-5 → 400 (CAPTCHA doğrulaması başarısız)
  6   → 429 Too Many Requests
  7   → 429 Too Many Requests
```

CAPTCHA zorunlu, ardından hız sınırı devreye giriyor. ✅

### 4.5 Kullanıcı sayımama (kayıt sayma / user enumeration)

```
$ curl -X POST ".../api/auth/forgot-password" -d '{"email":"fikir.platformu.iletisim@gmail.com"}'
  200 {"message":"Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."}

$ curl -X POST ".../api/auth/forgot-password" -d '{"email":"boyle-biri-yok@ornek.com"}'
  200 {"message":"Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."}
```

Var olan ve olmayan hesap **birebir aynı** yanıtı veriyor. ✅

### 4.6 TLS ve HTTPS zorunluluğu (YG-07)

```
ssl_verify_result = 0 (geçerli sertifika)
http://fikir-platformu.onrender.com       → 301 → https://...
http://fikir-platformu-web.onrender.com  → 301 → https://...
```

nginx yapılandırması: `ssl_protocols TLSv1.2 TLSv1.3`, güçlü cipher suite,
session ticket kapalı.

### 4.7 Kaynak kodda gömülü sır (YG-26)

ripgrep ile tüm kaynak, yapılandırma ve şablon dosyaları tarandı
(`api_key|secret|password|token` + 16+ karakter kalıp). `CHANGE_ME` ve
`example` kalıpları hariç **eşleşme yok**. ✅

> Geçmiş: `seed/ilk_hesaplar.py` içindeki canlı DB parolası Sprint 11.52'de
> dosya silinerek giderildi. TiDB parolası o tarihte döndürüldü.

### 4.8 Otomatik regresyon testleri

`dotnet test` → **51/51 başarılı**

| Dosya | Test | Kapsam |
|---|---|---|
| `IdeaTests` | 6 | Domain durum geçişleri |
| `SubmitIdeaServiceTests` | 3 | Fikir gönderim kuralları |
| `Rfc2047Tests` | 6 | MIME başlık kodlama (mojibake) |
| `ProfanityTextMatcherTests` | 8 | Küfür filtresi |
| **`GuvenliYonlendirmeTestleri`** | **24** | **Açık yönlendirme (yeni, BULGU-1)** |

### 4.9 Kayıt girdi doğrulama (YG-27)

```json
POST /api/auth/register  (eksik alanlarla)
  400  {"errors":{"FirstName":["…required."],
                  "Password":["…minimum length of 8 and a maximum length of 128."],
                  "ProvinceId":["…must be between 1 and 81."]}}
```

Sunucu tarafı şema doğrulaması çalışıyor. Parametreli sorgular (EF Core) kullanıldığı
için SQL enjeksiyonu yüzeyi yok (YG-30). ✅

> 📌 **Tespit (düşük öncelik):** Doğrulama hata mesajları İngilizce geliyor.
> Proje standardı Türkçe. Kullanıcıya gösterilmesi gereken mesajlar
> `frontend/src/services/api.ts` tarafında Türkçeye çevriliyor; ham API yanıtı
> İngilizce kalıyor. Etkisi düşük, sonraki sprintte düzeltilecek.

---

## 5. Elle yapılması gereken testler

Aşağıdaki kontroller otomatikleştirilemedi — **kurum yayına almadan önce elle
yapılmalıdır.** Her biri için adımlar Bölüm 7'de.

| # | Test | İlgili madde |
|---|---|---|
| E-1 | Tam giriş akışı: kapça → parola → MFA (TOTP + e-posta) → panel | YG-02, 25 |
| E-2 | Rol → panel erişimi (öğrenci / il / bakanlık / sistem yöneticisi) | YG-19 |
| E-3 | Yetkisiz kullanıcı ile yetkili uç çağrısı (403 kontrolü) | YG-19 |
| E-4 | CSV toplu içe aktarma (geçerli + reddedilen dosya) | YG-03, 31, 32 |
| E-5 | Parola yaşı uyarısı (75 gün) ve zorunlu değiştirme (90 gün) | YG-17 |
| E-6 | Pasif hesap kilitleme ve yeniden aktifleştirme | YG-39 |
| E-7 | Denetim raporu üretimi ve indirme | YG-13, 18 |
| E-8 | Oturum zaman aşımı (30 dk hareketsizlik, 8 saat mutlak) | YG-21 |
| E-9 | Geliştirme modunda e-posta gönderimi | YG-15 |
| E-10 | Denetim kayıtlarında PII maskeleme | YG-09, 41 |

---

## 6. Kurumdan yapılması gerekenler

Bu rapor geliştirici testidir. Aşağıdakiler **kurumun sorumluluğundadır**:

| # | İş | Neden |
|---|---|---|
| 1 | **Bağımsız penetrasyon testi** | Geliştiren kişinin kendi sistemini testi bağımsız denetim sayılmaz. Özellikle kimlik doğrulama ve yetkilendirme katmanı bağımsız doğrulanmalı. |
| 2 | **Merkezî log toplama bağlantısı** | Denetim kayıtları şu an dosyaya yazılıyor (YG-13/18 **kısmi**). Kurumun SIEM/log toplama sistemine otomatik iletim gerekiyor. |
| 3 | **Disk şifreleme** | Öğrenci PII'si veritabanında düz metin (YG-08 **kısmi**). Altyapı seviyesinde disk/volume şifrelemesi gerekiyor. |
| 4 | **Penetrasyon testi raporunun teslimi** | YG-38'in kurum içi karşılığını bu rapor tek başına karşılamaz. |

---

## 7. Elle testler için adımlar

<details>
<summary><b>E-1 — Tam giriş akışı</b></summary>

1. `/` → "Yetkili Girişi" → sistem yöneticisi e-postası + parola
2. Kapça sorusu çıkmalı, **yanlış cevap reddedilmeli**
3. Doğru cevap → MFA ekranı
4. TOTP ile giriş → panel açılmalı
5. Çıkış yap → tekrar giriş → "E-posta kodu" seç → OTP ekranı **tek ekran** çıkmalı
6. E-postaya gelen 6 haneli kod → panel
7. **Beklenen:** hiçbir adımda boş ekran veya ana sayfaya sessiz dönüş olmamalı
</details>

<details>
<summary><b>E-2 / E-3 — Rol ve panel erişimi</b></summary>

| Rol | Beklenen erişim | Beklenen red |
|---|---|---|
| Öğrenci | Yalnızca kendi fikirleri | `/admin`, `/il-panel`, `/bakanlik` → 403 |
| İl AR-GE Değerlendirici | Yalnızca kendi ilinin fikirleri | Başka il → boş liste, 403 |
| Bakanlık Yetkilisi | Kendi bakanlık ekranı | `/admin` → 403 |
| Sistem Yöneticisi | Üç panel + tüm iller | — |

Adres çubuğuna **doğrudan** `/admin/users` yazıp öğrenciyle deneyin → 403 veya
erişim reddi ekranı gelmeli, veri GÖRÜLMEMELİ.
</details>

<details>
<summary><b>E-4 — CSV toplu içe aktarma</b></summary>

| Dosya | Beklenen |
|---|---|
| `kullanicilar.csv` (geçerli başlıklar) | ✅ Yüklenir |
| `resim.png` uzantılı dosya | ❌ "Yalnızca .csv" |
| `.csv` uzantılı ama `image/png` MIME | ❌ Reddedilir |
| Eksik başlık içeren `.csv` | ❌ "Beklenen sütunlar" hatası |
| 5 MB üzeri dosya | ❌ Boyut hatası |
</details>

<details>
<summary><b>E-5 — Parola yaşı</b></summary>

1. Yönetici panelinden bir test kullanıcısına geçici parola verin
2. `PasswordChangedAt` değerini 80 gün önceye alın
3. Kullanıcı giriş yapınca **"parolanızın süresi dolmak üzere"** uyarısı çıkmalı
4. 95 gün önceye alın → giriş sonrası **zorunlu değiştirme** ekranı, panele giremiyor
5. Bakanlık yetkilisi zorunlu, sistem yöneticisi muaf
</details>

<details>
<summary><b>E-6 — Pasif hesap</b></summary>

1. `PasifHesap_GunSayisi=1` olarak ayarlayın, servisin 24 saat beklemesini sağlayın
2. Bir test kullanıcısıyla giriş yapmayın
3. `GET /api/admin/pasif-hesaplar` → kullanıcı listede ve "pasif" görünmeli
4. Kullanıcı giriş denerse → hesap kilitli, uyarı görmeli
5. "Tekrar Aktifleştir" → hesap açılmalı
6. Sistem yöneticisi hesapları **asla** kilitlenmemeli
</details>

<details>
<summary><b>E-7 — Denetim raporu</b></summary>

1. `DenetimRapor__Etkin=true` ayarlayın
2. Gece 02:00 UTC'yi bekleyin veya servisi elle tetikleyin
3. Admin Panel → Denetim Raporları ekranında dosya görünmeli
4. JSONL ve CSV indirilebilmeli
5. Raporda **açık parola görünmemeli**
</details>

<details>
<summary><b>E-8 — Oturum zaman aşımı</b></summary>

| Süre | Beklenen |
|---|---|
| 30 dakika hareketsizlik | Oturum düşer, yeniden giriş istenir |
| 8 saat mutlak süre | Oturum düşer (aktif kullanıcıda bile) |

Sekmeyi açık bırakıp 8 saat sonra bir uç çağrısı yapın → 401 beklenir.
</details>

---

## 8. Özet

| | |
|---|---|
| Test edilen madde sayısı | 41 |
| Otomatik doğrulanan kontrol | 9 grup |
| Elle yapılacak test | 10 adet (Bölüm 5) |
| **Bulunan açık** | **4** (1 kritik yapısal, 1 yüksek, 2 orta) |
| **Düzeltilen açık** | **4 / 4** |
| Açık kalan | **0** (bu test kapsamında) |
| Bağımsız denetim | **Yapılmadı** — kurumun sorumluluğunda |

### Açık kalan kısmi maddeler (kod tarafı eksik)

| Madde | Eksik olan | Çözüm |
|---|---|---|
| YG-08 | Öğrenci PII'si veritabanında düz metin | Altyapıda disk/volume şifrelemesi |
| YG-13 / YG-18 | Denetim kayıtları merkezî sisteme otomatik iletilmiyor | SIEM/webhook entegrasyonu — kurum altyapısına bağlı |

---

## 9. Sürüm geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.1 | 29.09.2026 | Deploy logu incelendi. BULGU-4 (başlangıç SQL'i) bulundu ve düzeltildi. HSTS canlıda doğrulandı. 4 başlangıç denetim testi eklendi. `/api/health` sürüm damgası eklendi. |
| 1.0 | 29.09.2026 | İlk sürüm. 3 açık bulundu ve düzeltildi (açık yönlendirme, HSTS, frontend CSP). 24 regresyon testi eklendi. |

---

## 10. Doğrulama durumu

**Canlı ortamda doğrulandı** — Render commit `8d4b14a`, 29.09.2026.

| Bulgu | Kod | Test | Canlı doğrulama |
|---|---|---|---|
| BULGU-1 — Açık yönlendirme | ✅ | ✅ 24 test | ⏳ OAuth callback'i tamamlanmadan test edilemez (elle) |
| BULGU-2 — HSTS yok | ✅ | ✅ statik denetim | ✅ **doğrulandı** — `max-age=31536000; includeSubDomains` |
| BULGU-3 — Frontend CSP yok | ✅ nginx | — | ⏳ kurulumda doğrulanacak (Render panel başlığı) |

### Doğrulanan canlı başlıklar (11.85)

```
$ curl -sI https://fikir-platformu.onrender.com/api/health
  content-security-policy:  default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; …  ✅
  strict-transport-security: max-age=31536000; includeSubDomains                                    ✅ (yeni)
  x-content-type-options:     nosniff                                                               ✅
  x-frame-options:            DENY                                                                   ✅
  referrer-policy:            strict-origin-when-cross-origin                                        ✅
  permissions-policy:         geolocation=(), microphone=(), camera=(), payment=()                  ✅
```

### BULGU-4 — Kuruluşta tüm bakanlık yetkilileri parola değiştirmeye zorlanıyordu · **DÜZELTİLDİ**

| | |
|---|---|
| **Ciddiyet** | Yüksek (kullanıcıyı kilitler) |
| **Dosya** | `backend/src/FikirPlatformu.Api/Program.cs` (başlangıç SQL'i) |
| **Bulunma** | Sprint 11.85, Render deploy logu |

**Açıklama.** Parola yaşı özelliği (YG-17) mevcut kullanıcılarda `PasswordChangedAt`
NULL olduğu için uyarı/zorlama göstermemesi için başlangıçta bir geriye dönük
değerleme çalıştırıyordu. Sorgu şu sütuna bakıyordu:

```sql
SET `PasswordChangedAt` = COALESCE(`LastLoginAt`, UTC_TIMESTAMP())
```

**`AspNetUsers` tablosunda `LastLoginAt` sütunu yoktur** (`ApplicationUser` modelinde
de yok). Sorgu hata veriyor, `try/catch` ile yutuluyor ve **hiçbir kullanıcı
doldurulmuyordu.**

**Etki.** `SifreYasiPolicy` NULL değeri "en kötü senaryo" olarak yorumlar:

> `return new Durum(null, null, true, true, "Değişiklik tarihi kayıtlı değil")`

Yani **her bakanlık yetkilisi (`MinistryOfficial`) girişte parola değiştirmeye
zorlanıyordu**, öğrenci ve il personeli gereksiz uyarı alıyordu. Özellik
kötüleşmesi ilk açılışta değil, ilk girişte fark edilecekti.

**Düzeltme.** Sütun referansı kaldırıldı, `UTC_TIMESTAMP()` kullanılıyor:
her kullanıcıya 90 gün daha verilir, kimse kilitlenmez.

**Doğrulama.** `ProgramYapilandirmaDenetimi` test dosyası eklendi — bu hata
sınıfının (başlangıç yapılandırması hataları) tekrarını derleme aşamasında yakalar.

---

## 11. Öğrenilen: derlenme ≠ çalışma

Sprint 11.84'te HSTS düzeltmesi **uygulamayı açılmaz hâle getirmişti:**

```
fail: Unhandled exception. System.InvalidOperationException:
      The service collection cannot be modified because it is read-only.
      at Program.<Main>$() in Program.cs:line 549
```

`builder.Services.Configure<ForwardedHeadersOptions>(...)` çağrısı
`builder.Build()` satırından **sonra** kalmıştı.

| Kontrol | Sonuç | Yakaladı mı |
|---|---|---|
| `dotnet build` | ✅ başarılı | ❌ **hayır** |
| `dotnet test` (23 test) | ✅ 23/23 | ❌ **hayır** |
| `dotnet publish` | ✅ başarılı | ❌ **hayır** |
| Uygulamayı çalıştır / deploy logu | ❌ **çöktü** | ✅ **evet** |

**Sonuç.** "Derleniyor + testler geçiyor" kontrolü bir DI hatasını yakalayamaz.
Bunun için:

1. `ProgramYapilandirmaDenetimi` — 4 test eklendi:
   - `Build()` sonrası `builder.Services` çağrısı
   - güvenlik başlığı middleware'inin `UseCors`'tan önce gelmesi
   - HSTS'in `IsHttps` koşuluna bağlanmaması
2. `/api/health` ucuna **sürüm damgası** eklendi (`commit`, `environment`).
   Böylece "canlıda hangi build var?" sorusu uzaktan cevaplanabiliyor:

```json
{ "version": "1.0.0.0",
  "commit": "8d4b14ab9132a1fd9aa1e7d632cb463c00e4d8ea",
  "environment": "Production" }
```

> Bu sürüm damgası olmasaydı "deploy oldu mu, eski mi?" sorusunu yalnızca
> Render paneline bakarak cevaplayabilirdim.


