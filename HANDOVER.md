# Handover — Fikir Platformu (HEAD: `2aac7fe`)

> **Amaç:** Yeni AI oturumu açıldığında **HANDOVER + CLAUDE.md** okuyunca sprint state ve açık işler net olsun. Mimari için `docs/architecture.md`, operasyon için `docs/runbook.md`, kurum gereksinimleri için `docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md`.

---

## 🔴🔴 CANLI ORTAM HATASI — ÇÖZÜLMEDİ, YENİ OTURUM BUNU ÖNCE OKUSUN

**Belirti:** Tüm e-posta gönderimi 500 hatası veriyor.

```
POST /api/auth/mfa/send-email-otp   → 500 "İşlem sırasında beklenmeyen bir hata oluştu."
POST /api/auth/register             → 500 (doğrulama e-postası gönderilemiyor)
```

Kullanıcıya görünen: *"Kod gönderiliyor…"* → *"Kodu tekrar gönder"* → *"İşlem sırasında beklenmeyen bir hata oluştu."*

**Teşhis (9 Eki 2026):** `Mail__Type=gmail` → `GmailApiEmailSender`. `GetAccessTokenAsync` veya `SendAsync` fırlatıyor, `MfaEndpoints` `SendAsync`'ı **try/catch ile sarmalamıyor** → ham `InvalidOperationException` ASP.NET'in genel 500 maskesine düşüyor. Gerçek neden logda (`[GMAIL]` satırları), yanıtta **görünmüyor**.

**Doğrulanmış olanlar:**
- `Mail:Gmail:ClientId` **VAR** — `/api/auth/gmail-oauth/start` 302 ile Google'a yönlendiriyor (client_id `243209544707-…apps.googleusercontent.com`)
- Hata **göndericiye özgü değil** — kayıt ucu da aynı 500'ü veriyor, yani `IEmailSender` katmanı bozuk
- `Mail__Gmail__SenderAddress` ayarlanmamış olabilir (`GmailApiEmailSender.cs:69` erken fırlatır)

**Muhtemel patlama noktaları** (`GmailApiEmailSender.cs`):

| Satır | Koşul |
|---|---|
| 69 | `Mail__Gmail__SenderAddress` boş |
| 123 | `ClientId`/`ClientSecret` eksik |
| 135 | Refresh token yok (DB `gmail_refresh_tokens` Id=1 boş **veya** env eksik) |
| 158 | Refresh token reddedildi (geçersiz/expire) |

**Sonraki adım:** Render loglarında `[GMAIL]` **ve** `[MAIL]` satırlarını bul → hangi koşul tutuyor.

> 🟡 **Sprint 11.92 — iki düzeltme yapıldı, kök neden HÂLÂ bulunmadı.**
>
> 1. **Ekran kilitlenmesi düzeltildi.** `MfaLoginPage.tsx`'te gönderim durumu
>    TÜRETİLİYORDU (`emailModu && !emailGonderildi`) ve `emailGonderildi` yalnızca
>    başarıda `true` oluyordu → 500 sonrası buton "Kod gönderiliyor…" metninde
>    donuyor, kod alanı kalıcı pasifleşiyordu. Artık gerçek state, `finally`'de
>    sıfırlanıyor; başarısızlıkta ana buton "Kodu tekrar gönder"e dönüşüyor.
> 2. **Genel 500 kaldırıldı.** `Endpoints/EpostaGonderimGuvenli.cs` — tüm
>    `SendAsync` çağrıları (MFA kurulum, MFA giriş OTP, kayıt doğrulama, şifre
>    sıfırlama) try/catch ile sarıldı. Artık **502 + Türkçe mesaj +
>    `errorCode: MAIL_SEND_FAILED`** dönüyor, sunucu loguna `[MAIL]` + istisna
>    yazılıyor, `auth_events`'e başarısızlık kaydı giriyor (denetim izi).
>
> Yani sonraki denemede hata **hangi koşulun tuttuğunu** logda gösterecek.
> Teşhis için gerekli tek şey: Render logunda `[MAIL]` / `[GMAIL]` satırı.

**Etkilenen akışlar:** parola sıfırlama, kayıt doğrulama, MFA e-posta kodu. **TOTP MFA etkilenmez** (e-posta kullanmaz).

---

## 📌 HEAD

- **Commit:** `2aac7fe` (Sprint 11.88 — `architecture.md` bayat `needsGmailOAuth` dalı düzeltildi)
- **Branch:** main
- **Test:** 51/51 (xUnit), `tsc` temiz, frontend build başarılı
- **Last deploy:** Render auto-deploy main push (~2-3 dk backend, ~1-2 dk frontend)
- **Canlı backend damgası:** `/api/health` → `commit` alanı (en son okumada `5c1e073`; sonraki 3 commit yalnız frontend/yaml)

## 🌐 Services

| Service | URL | Tech |
|---|---|---|
| Frontend (Static Site) | `https://fikir-platformu-web.onrender.com` | React 19 + Vite 8 + TS 7 |
| Backend (Docker) | `https://fikir-platformu.onrender.com` | .NET 10 + EF Core 9 (Pomelo MySQL) |
| DB (TiDB Cloud) | `gateway01.eu-central-1.prod.aws.tidbcloud.com:4000` | MySQL-compatible |

## 🧪 Test User

| Field | Value |
|---|---|
| Email | `fikir.platformu.iletisim@gmail.com` |
| Roles | SystemAdmin + MinistryOfficial |
| Otobirim (seed) | `SeedSystemAdmin__Email` / `SeedSystemAdmin__Password` env'den |
| Öğrenci test hesabı | `test.ogrenci@yegitek.test` / `Ogrenci.Test1!` (Sprint 11.86'da açıldı, e-posta doğrulandı) |

> 🔒 **Şifreler bu dosyada tutulmaz** (Sprint 11.52). Render env (`SeedSystemAdmin__Password`) veya parola kasası.
> Şifre değiştirme sonrası MFA yeniden kurulur; parola değişimi oturumu geçersiz kılar (Sprint 11.55).

## 🎯 Sprint State (HEAD: `5e7c16c`)

### ✅ YEĞİTEK Güvenlik Uyumlaması — 38/41 tam, 3 kısmi

Kaynak: `docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md` (41 maddelik kurum listesi)
Güvenlik test raporu: `docs/YGITEK-GUVENLIK-TEST-RAPORU.md` (YG-38)

**Kapatılan başlıklar (Sprint 11.51–11.63):**

| Sprint | Konu | Maddeler |
|---|---|---|
| 11.51 | Gmail token env'e taşındı, DB tablosu düştü; hardcoded Render origin kaldırıldı | - |
| 11.52 | Canlı DB parolası `seed/ilk_hesaplar.py` içinde bulundu → **dosya silindi**, `.NET` seed yolu; bayat `compose.yaml` (PostgreSQL) silindi; `deploy/nginx/fikir.conf` eklendi; `scripts/verify.sh` + `scripts/make_handover.sh` (Linux-native) | YG-20 |
| 11.53 | Parola politikası 5 sınıfa çıkarıldı (≥8 karakter, büyük, küçük, rakam, özel karakter). Türkçe hata mesajları. Kullanılmayan hesap servisi yeniden açıldı (90 gün → pasife al, `SystemAdmin`/`MinistryOfficial` muaf) + admin rapor/endpoint | **YG-16, YG-39** |
| 11.59 | Gmail gönderen adı mojibake (RFC 2047 encoded-word) | — |
| 11.60 | 90 günlük parola yaşı. Uyarı 75 gün. Rol tabanlı zorlama: `MinistryOfficial` zorunlu; `Student`/`ProvinceEvaluator`/`ProvinceManager` tavsiye; `SystemAdmin` muaf. `/api/auth/me` → `sifreDegistirmeZorunlu`, global `SifreKilit` | **YG-17** |
| 11.61 | Denetim raporları: gece 02:00 UTC JSONL + admin CSV özeti | YG-13, YG-18 (kısmi) |
| 11.62 | Her sayfadan oturum sonlandırma (sabit düğme kaldırıldı, panele taşındı) | YG-20 |
| 11.63 | CSV beyaz listesi: `.csv` uzantısı + izinli MIME + başlık doğrulaması (istemci metadata'sına güvenilmiyor) | YG-03, YG-31, YG-32 |

### ✅ Arayüz ve Kimlik Doğrulama Düzeltmeleri (Sprint 11.64–11.81)

| Sprint | Konu |
|---|---|
| 11.64 | Admin paneli İl AR-GE tasarım diline çekildi; kullanıcı listesi kart listesinden **tabloya**; `styles.css` 2004 → 1401 satır |
| 11.65 | `/admin` sahte sayfası (iki rota aynı bileşen) kaldırıldı; `/admin/*` kenar paneline geçti |
| 11.66 | MFA akışı: eski `needsGmailOAuth` yönlendirmesi (Sprint 11.51 sonrası artık geçersiz artık) kaldırıldı; rol filtresi tek satır |
| 11.67 | 11.66'daki aşırı tema değişiklikleri geri alındı, Playwright ile doğrulama kuralı getirildi |
| 11.68 | Anasayfa altı "Ayın Fikri Arşivi" / "Yetkili Girişi" tek rozet temasına alındı (özgüllük tuzağı düzeltildi: `button.ozellik`, `styles.css` son yükleniyor) |
| 11.69–11.70 | Tablolar tek satıra sığacak şekilde genişletildi (`max-width: 78rem` kaldırıldı); filtre çubuğu tek satır; şifre ekranları ortak temaya; MFA çift ekran hatası giderildi |
| 11.71 | Sistem yöneticinin üç panele erişimi; rol bazlı yönlendirme butonları; sabit çıkış düğmesi kaldırıldı |
| 11.72 | `/me` artık `roles` döndürüyor; oturum etiketi **rolden** (context'ten değil); "Fikirlerim" yönlendirmesi tamamen kaldırıldı |
| 11.73 | `/fikir` sayfasındaki panel seçimi ana sayfayla **aynı bileşenden** (`YetkiliPanelSecim.tsx`) besleniyor |
| 11.74 | Sistem yöneticisi `il-panel`'a giriyor ve **tüm illeri** görüyor (`int? ilId`, `null` = tüm iller) |
| 11.75 | Gerçek kök neden: `principal.IsInRole()` `CreateUserPrincipalAsync` principal'ında **her zaman false** dönüyordu (rol claim'i üretmez) |
| 11.76 | Rol claim'leri girişte **açıkça** yazılıyor (`RolleriEkle`); `/me` → `gelenSchemeler` tanı koyabilir |
| 11.77 | Toplu Kullanıcı Ekleme düzeni (CSV Sütunları üstte, Nasıl hazırlanır? + Dosyayı Yükle yan yana, Örnek CSV altta); **sessiz yönlendirme → açık uyarı** |
| 11.78 | **Asıl kök neden:** `KullaniciBilgisiGetir` context'i rolden *tahmin* ediyordu; sistem yöneticisinin province cookie'si `ministry` diye etiketleniyordu. Çağırandan alınıyor |
| 11.79 | Kenar paneli menüsü ve çıkış bağlamı **panele** göre (role göre değil) |
| 11.80 | İl yönetimi yetkisi tek kurala bağlandı: `YetkiliPanelSecim.ilYoneticiMi()` (aynı hata 3 ayrı yerde tekrarlamıştı) |
| 11.81 | Tüm sayfalarda mobil uyumluluk: **ölçüldü** (320-1920px), 2 gerçek taşma hatası düzeltildi |
| 11.82 | `.env.example` **kodla hizalandı** (3 yanlış değişken adı → kurulum sessizce başarısız olurdu), kalan MD senkronizasyonu |
| 11.83 | `Captcha__Disabled` kaldırıldı — kullanılmamıştı, üretimde yanlışlıkla açılma riskiydi |
| 11.84 | **YG-38 güvenlik test raporu.** 4 açık bulundu: açık yönlendirme (OWASP A01), HSTS yok, frontend CSP yok, bozuk başlangıç SQL'i |
| 11.85 | DI kaydı `Build()` sonrasında kalmıştı → **deploy çöktü**. `LastLoginAt` kolonu yoktu. 4 başlangıç denetim testi + `/api/health` sürüm damgası |
| 11.86 | `/fikir` yöneticiye kapandı (panel seçimi gösterir); Yönetici Ekle formu düzenlendi. Test öğrenci hesabı açıldı; bakım ucuna `confirmEmail` + `zorlamaYok` bayrakları (e-postasına ulaşamayan kullanıcı sonsuza kadar kilitliydi) |
| 11.87 | "Fikrini Yaz" CTA'sı yöneticide sayfa değiştirmeden panel seçimini açıyor. `Cryptography.Xml` 10.0.10'a sabitlendi (7 high advisory) |
| 11.88 | **Öğrenci fikir durumu ekranı.** `fikirAsamalari.ts` (10 backend durumu → 5 görsel aşama, tek kaynak) + `FikirAsamaCizgisi.tsx`. `render.yaml` kendi hatam düzeltildi (`type: static` geçersizdi, iç içe `headers:` söz dizimi yanlıştı) |
| 11.91 | Liste tek satıra sığdı; "Gönderilmiş Fikirlerim" / "Taslaklarım" ayrımı; `Kilitli` → `Planlandı`; çıkış gönder butonunun yanına; **MFA ekranlarında çıkış gerçekten çıkış yapmıyordu** (`mfaCancel` ≠ `logout`) |

### 🔧 Auth zinciri — Sprint 11.71–11.78 özeti

Bu dört sprint, **aynı hatada dört kez yanlış kök neden** bulundu. Hepsi derleniyordu, testler geçiyordu, politika açılmış görünüyordu — ama kullanıcı **sessizce ana sayfaya** atılıyordu. Sebep: `ProtectedRoute` hata göstermiyordu.

| # | Katman | Durum |
|---|---|---|
| 1 | `GirisIcinSchemeSec` → `SystemAdmin` tüm context'ler | ✅ 11.71 |
| 2 | `MfaEndpoints` scheme upgrade'de ek cookie'ler | ✅ 11.71/11.75 |
| 3 | Rol claim'leri principal'a yazılıyor | ✅ 11.76 |
| 4 | `KullaniciBilgisiGetir` context'i çağırandan alıyor | ✅ 11.78 |

> 📌 **Ders (kalıcı kural):** Auth zinciri değişikliklerinde yalnızca "derleniyor / testler geçiyor" **yetersizdir**. Gerçek çalışma yolu uçtan uca doğrulanmalı. Sessiz hatalar görünür olmalı — `ProtectedRoute` artık panel oturumu yoksa **açık uyarı** gösterir.

### 📁 Yeni dosyalar (Sprint 11.52+)

| Dosya | Amaç |
|---|---|
| `frontend/src/admin-theme.css` | Admin panelinin güncel tema katmanı |
| `frontend/src/components/YetkiliPanelSecim.tsx` | Rol → panel eşlemesi, `rolEtiketi`, `ilYoneticiMi`, `fullPageNav` — **tek doğruluk kaynağı** |
| `frontend/public/mobil-test.html` | Mobil ölçüm sayfası (gerçek CSS yükler, Playwright ile ölçülür) |
| `deploy/nginx/fikir.conf` | TLS + `/api` proxy + SPA fallback |
| `scripts/verify.sh`, `scripts/make_handover.sh` | Linux-native doğrulama ve paketleme |
| `docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md` | 41 maddelik kurum listesi ve durum |
| `docs/YGITEK-GUVENLIK-TEST-RAPORU.md` | **YG-38 test raporu** — 25 test, 4 bulgu, 4 düzeltme (kurum formatında, kısa) |
| `docs/YEGITEK-TESLIM-BEKLEYEN-BILGILER.md` | Onur'dan teyit bekleyen bilgiler |
| `frontend/src/services/fikirAsamalari.ts` | Backend'in 10 `IdeaStatus` değerini 5 görsel aşamaya eşleyen **tek kaynak** |
| `frontend/src/components/FikirAsamaCizgisi.tsx` | Aşama çizgisi — gönderim sonrası ekranla **aynı** bileşen |

## 🚧 Açık işler

### 🔴 Teslimi bloklayan

- **E-posta gönderimi 500 veriyor** (kayıt doğrulama + MFA kodu + parola sıfırlama) — bu dosyanın en üstündeki bölüme bak. Render logunda `[GMAIL]` satırı hangi koşulun tuttuğunu söyler. Sonra `SendAsync` çağrıları `try/catch` ile sarılmalı, genel 500 yerine anlamlı mesaj dönmeli.
- **Alan adı, DB adresi, kurulum yolu, SMTP/OAuth değerleri** — `docs/YEGITEK-TESLIM-BEKLEYEN-BILGILER.md`. Onur'dan gerçek değerler bekleniyor. `.env.example` içindeki kurumsal değerler **tahmindir**.
- **Bağımsız penetrasyon testi** — geliştiricinin testi bağımsız denetim sayılmaz. Kurumun kendi güvenlik ekibiyle yaptırılmalı (`docs/YGITEK-GUVENLIK-TEST-RAPORU.md` Bölüm 6).
- **Render `/assets/*` cache yolu** — dashboard'da `/assets` yazılmış, `/assets/*` olmalı. Hash'li varlıklar şu an 5 dk cache'leniyor (1 yıl değil). `render.yaml` doğru, mevcut servis elle düzeltilmeli.

### 🟡 41 maddenin açık kalanları (3 kısmi)

| Madde | Eksik yön |
|---|---|
| **YG-13 / YG-18** | Hareket kayıtları `auth_events` tablosunda, `DenetimRaporServisi` her gece 02:00 UTC'de JSONL + CSV yazıyor, yönetici ekrandan indiriyor. **Kurumun merkezî sistemine otomatik iletim yok** — dosya/betik aktarımı tam uyum sayılmaz, teslimde açıklanmalı. Hedef URL/protokol Onur'dan bekleniyor. |
| **YG-08** | İletim ve depolama şifreli, ancak **öğrenci PII'si (ad-soyad, TC, telefon) DB'de düz metin**. Çözüm: altyapı seviyesinde disk/volume şifrelemesi. |

### 🟢 Sprint 12 backlog

- **Per-user Gmail mimarisi** (ADR 0001) — Sprint 12 planı
- **Maintenance endpoint'leri production'dan kaldır** — Sprint 12'de admin paneli ile değiştir
- **AWS SES migration** — Gmail Test Mode 100 kullanıcı limiti + 7 günlük refresh token
- **Email template yönetimi** — şu an hardcoded HTML
- **i18n altyapısı** — şu an hardcoded Türkçe
- **Frontend test (Vitest)** — şu an yalnızca manuel Playwright doğrulaması
- **Production domain** — Sprint 13+

### 🔧 Known issues

- **EF Core CLI sandbox sorunu** — `dotnet ef migrations add` dosya yazmıyor (Windows kernel sandbox). Sprint 11'de startup idempotent raw SQL ile çözüldü; yeni migration CI veya temiz bash'te üretilmeli.
- **Modal içinde `useNavigate()` çalışmıyor** — `fullPageNav()` (`window.location.href`) kullanılıyor. React Router declarative mod.
- **`docs/DURUM.md` arşiv** — Aşama 0-10 (2026-09-26), PostgreSQL dönemi. Güncel değil, güncel liste `docs/architecture.md`.
- **`compose.yaml` silindi** (Sprint 11.52) — PostgreSQL 18 image'ıydı, uygulama Pomelo MySQL. Lokal DB: TiDB Cloud veya `docker-compose.yml`.

## ⚡ Hızlı referans

### Env — Render dashboard

Değerler **bu dosyada tutulmaz**. Render → Environment.

| Değişken | Not |
|---|---|
| `ConnectionStrings__MySql` | SECRET — TiDB Cloud bağlantısı |
| `Mail__Type` | `gmail` |
| `Mail__Gmail__ClientId` | Google OAuth client ID |
| `Mail__Gmail__ClientSecret` | **SECRET** |
| `Mail__Gmail__RedirectUri` | callback adresi |
| `Mail__Gmail__SenderAddress` | gönderen hesap |
| `Frontend__BaseUrl` | `https://fikir-platformu-web.onrender.com` |
| `Cors__AllowedOrigins` | **Zorunlu** — hardcoded fallback 11.51'de kaldırıldı |
| `AdminMaintenance__Secret` | **SECRET — zorunlu.** Gömülü varsayılan kaldırıldı; tanımlı değilse maintenance endpoint'leri 403 döner |
| `SeedSystemAdmin__Email` / `SeedSystemAdmin__Password` | İlk admin. **Yalnızca boş veritabanında** çalışır (mevcut Render DB'sine eklemek hiçbir şey yapmaz) |
| `PasifHesap_GunSayisi` / `PasifHesap_KontrolGunu` / `PasifHesap_Enabled` | Kullanılmayan hesap servisi (varsayılan 90 gün) |

### Roller ve paneller

| Rol | Panel | Not |
|---|---|---|
| `Student` | `/fikir` | Panel yok; öğrenci kendi fikirlerini yazar |
| `ProvinceEvaluator` | `/il-panel` | Kendi ili |
| `ProvinceManager` | `/il-panel` | Kendi ili + ekip yönetimi |
| `MinistryOfficial` | `/bakanlik` | Tüm ülke |
| `SystemAdmin` | `/admin` + `/bakanlik` + `/il-panel` | **İstisna** (kurum kuralı) |

> Kurum kuralı: *"Sistem Yöneticisi dışında kimsede birden fazla panele erişemez."*
> Yetki kodu her zaman `YetkiliPanelSecim.ilYoneticiMi()` gibi **ortak bir kurala** bakar, doğrudan `roles.includes("...")` yazmaz. S11.79–11.80'de bu kural üç ayrı yerde ayrı yazılmıştı.

### Maintenance endpoints

| Endpoint | Amaç |
|---|---|
| `POST /api/__maintenance/unlock-account?token=...&email=...` | Identity lockout temizle |
| `POST /api/__maintenance/set-password-raw?token=...&email=...&password=...` | PasswordHash direkt set |
| `POST /api/__maintenance/clear-must-change-password?token=...&email=...` | MustChangePassword kapat |
| `POST /api/__maintenance/admin-reset?token=...` | Sistem yöneticisi hesabını yeniden oluştur |
| `GET /api/auth/__debug/last-login?token=...` | Son login denemesinin detayı |
| `GET /api/auth/__debug/mail-sender?token=...` | Gmail sender bilgisi |

> Token = `AdminMaintenance__Secret`. **Sprint 12'de tamamen kaldırılacak.**

### Admin paneli endpoint'leri

| Endpoint | Not |
|---|---|
| `GET /api/province/inbox` | Sistem yöneticisi için **tüm iller** (`ilId = null`) |
| `GET /api/province/candidates` | Aday havuzu, tüm iller |
| `GET /api/province/evaluators` | Sistem yöneticisi il seçmek zorunda (`provinceId` istekte) |
| `POST /api/province/ideas/{id}/assign` | Somut il = fikrin kendi ili (`SomutIlAsync`) |
| `GET /api/admin/pasif-hesaplar` | 90 gün hareketsiz hesaplar |
| `POST /api/admin/pasif-hesaplar/tekrar-aktiflestir` | Pasif hesabı geri aç |

## 📐 Frontend yerleşimi

```
index.html
  ├── <link> public/assets/css/fonts.css
  ├── <link> public/assets/css/stil.css          ← anasayfa + panel dili (72 KB)
  └── <link> /assets/index-*.css                  ← src/styles.css + src/admin-theme.css
                                                   (Vite, **her zaman en son** yüklenir)
```

> ⚠️ **Yükleme sırası tuzağı:** `src/` içindeki CSS her zaman `public/assets/css/stil.css`'i ezebilir. Bu iki yüzey ayrı ayrı bakım gerektirir. S11.68'de ana sayfa düğmelerinin rozeti bu yüzden görünmüyordu (`button.ozellik` özgüllüğü).

## 📜 Son commit'ler

```
20d1df7 Sprint 11.81: tum sayfalarda mobil uyumluluk olculdu ve duzeltildi
b094d9d Sprint 11.80: il yonetimi yetkisi tek kurala baglandi
0519f42 Sprint 11.79: kenar paneli menusu ve cikis baglami PANELE gore
adac877 Sprint 11.78: /me contexti rolden tahmin etmiyordu - GERCEK KOK NEDEN
58e0d76 Sprint 11.77: toplu ekleme duzeni + sessiz yonlendirme kaldirildi
6003fc3 Sprint 11.76: rol claimleri acikca yaziliyor
ce0629e Sprint 11.75: sistem yonetici province cookie'i gercekten yaziliyor
39a422f Sprint 11.74: sistem yonetici il-panel'a girer ve tum illeri gorur
2aac7fe Sprint 11.88: architecture.md bayat needsGmailOAuth dalini duzelt
5b675e1 Sprint 11.88: render.yaml bayat _redirects yorumu duzeltildi
faad9e7 Sprint 11.88: render.yaml type:static ve ic ice headers sozdizimi hatasi duzeltildi
6f04e31 Sprint 11.91: btn-tam esnesin, 94px yatay tasma duzelt
2c0ea7c Sprint 11.91: fikir listesi iki bolum, Locked etiketi duzelt, buton tek satir, MFA cikislari gercekten cikis yapiyor
5c1e073 Sprint 11.87: YG-38 raporuna bagimlilik acigi ekle
8ee9180 Sprint 11.87: Cryptography.Xml 10.0.10 sabitle (7 high advisory)
f43b913 Sprint 11.86: fikir listesi tek satir, durum butonu temaya uygun, cikis gonder butonunda
977198f Sprint 11.89: fikir listesi tek satira sigdi, Durumu butonu temalandi, cikis gonder butonu yanina tasindi
9f7cc81 Sprint 11.86: Render Static Site tipi duzeltildi (type: static) + guvenlik basliklari eklendi
46a31f5 Sprint 11.88: gonderilen fikir tiklanabilir, durum asamalari her an gorulebilir
d7b728b Sprint 11.87: Fikrini Yaz CTA'si yoneticiye sayfa degistirmeden panel secimi modalini acar
b8db4c0 Sprint 11.86: set-password-raw aracina e-posta onaylama ve zorlama kaldirma bayraklari (hesap kurtarma)
5a761ef Sprint 11.86: /fikir yoneticiye kapali (panel secimi gosterir), Yonetici Ekle formu duzenlendi
78794f7 Sprint 11.85: YG-38 rapor referanslari guncellendi (HANDOVER, 41 madde tablosu, SECURITY)
8d8ee0c Sprint 11.85: YG-38 test raporu kisaltildi (500 -> 110 satir, kurum formatinda)
08f689c Sprint 11.85: YG-38 tamamlandi (38/41), HANDOVER + AGENTS + test sayilari senkron
5e7c16c Sprint 11.85: test raporu guncellendi - BULGU-4, canli HSTS dogrulamasi, derlenme-vs-calisma dersi
b490646 Sprint 11.73: /fikir panel secimi ana sayfayla ayni
b09499e Sprint 11.72: /me roles donuyor, Fikirlerim yonlendirmesi kaldirildi
d4bf1e8 Sprint 11.71: sistem yonetici il-panel erisimi
fc881b1 Sprint 11.70: filtre tek satir, sifre ekranlari yeni tema
d2df706 Sprint 11.69: tablo tek satir, rol tek rozet
f0de612 Sprint 11.68: Ayın Fikri Arşivi ve Yetkili Girişi aynı rozet teması
80d7bd5 Sprint 11.67: 11.66 tema degisiklikleri geri alindi
```

## 🛠 Çalışma kuralları (Onur)

- **Caveman modu ON** — Türkçe ultra-terse
- **Onay kısa:** "ONAYLIYORUM", "A", "devam et"
- **Görüntülemeden iş yapma** — UI değişikliğinden önce Playwright ile aç ve bak (S11.66'da 3 tur yanlış tema uyduruldu, hepsi geri alındı)
- **Ölç, tahmin etme** — Yatay taşma, genişlik, renk: ölçülebileni ölç (S11.81)
- **Git commit + push** her önemli değişiklik sonrası
- **İnternet search zorunlu** her fix öncesi (Microsoft Learn, Context7, brave)

## 🚀 Yeni oturumda ilk iş

1. **`AGENTS.md`** → **`CLAUDE.md`** → **`HANDOVER.md`** (bu dosya)
2. **`docs/architecture.md`** — endpoint listesi + mimari
3. **`docs/runbook.md`** — operasyon + maintenance
4. **`docs/YEGITEK-GUVENLIK-GEREKSINIMLERI.md`** — 41 madde durumu
5. **`docs/YEGITEK-TESLIM-BEKLEYEN-BILGILER.md`** — Onur'dan bekleyen bilgiler
6. Onur'a: "okudum, sıradaki görev ne?"

---

*Bu dosya sprint state + açık işler içindir. Mimari ve operasyon detayları için `CLAUDE.md` + `docs/`.*
