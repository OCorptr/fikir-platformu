# Proje Durumu — YENİ OTURUM AÇILDIGINDA ÖNCE BU DOSYAYI OKU

> Son güncelleme: 2026-09-20
> Ana plan: `docs/GELECEGIN_FIKRI_PROJE_PLANI.md` (40 bölüm + §41–44 karar günlüğü)
> Kaynak belge: `Fikir Platformu 11.08.2026.pdf`

Bu dosya, "hangi aşamadayız?" sorusunun tek kaynağıdır. Her önemli işten sonra
"Bir bakışta durum" bölümü güncellenir ve commit edilir.

> **ÖNEMLİ — kullanıcı kararı (2026-09-19):** React tarafındaki kayıt / giriş / doğrulama /
> profil / şifre akışları **iptal edildi** (kullanıcı istediği gibi yapılmadığı için).
> Sonra (2026-09-20) kullanıcı **inline modal** yaklaşımını onayladı: kayıt/giriş akışları
> `/fikir` sayfasında **AuthModal** (kapatılamaz, Fikrini Anlat temalı) olarak yeniden yazıldı;
> Aşama 2'nin ayrı sayfaları yerine bu kullanılıyor. Backend Identity uçları aynı — frontend
> artık `/api/auth/{register,login,verify-email,logout,me}` çağırıyor. Yeni uygulamada iki sayfa:
> `HomePage` (/) ve `FikirPage` (/fikir).

---

## Bir bakışta durum

| Aşama | Durum |
|---|---|
| 0 — Gereksinim mutabakatı | ✅ Tamam (plan §3 kesinleşen kararlar) |
| 1 — Teknik temel ve depo düzeni | ✅ Tamam |
| 2 — Kimlik ve öğrenci profili (backend) | ✅ Backend Identity uçları tamam; **frontend tüketicisi AuthModal (inline, /fikir)** |
| 2+ — Öğrenci arayüzü (React: kayıt/giriş/doğrulama/profil) | ✅ **Inline modal olarak yeniden yazıldı** (Aşama 3 frontend'le birlikte) |
| 2++ — Ana sayfa React'e taşındı (index.html birebir kopya) | ✅ Tamam |
| 3 — Fikir girişi (backend) | ✅ Tamam (17/17 birim testi + uçtan uca) |
| 3 — Fikir girişi (frontend) | ✅ Tamam — FikirPage backend'e bağlı; taslak kaydet/güncelle/sil + gönder çalışıyor; süreç takibi stepper korundu |
| 4 — İl AR-GE paneli (backend) | ✅ Tamam — inbox + read + assign + evaluators uçları; idea_read_receipts + idea_assignments migration; seed (manager/evaluator İstanbul); uçtan uca test |
| 4 — İl AR-GE paneli (frontend) | ✅ Tamam — `/il-panel` (InboxPage) + `/il-panel/fikir/{id}` (ApplicationDetailPage); Üst bar'da rol bazlı link + kullanıcı adı |
| 5 — Değerlendirme akışı (backend) | ✅ Tamam — Evaluation entity (4 kriter, 1-5 puan), idea_evaluations migration, SubmitEvaluationService (durum geçişleri), ApproveIdeaService, CandidatesQueryService; uçtan uca 4.25 ortalama → aday → onay → Locked |
| 5 — Değerlendirme akışı (frontend) | ✅ Tamam — detayda Puanla/Yorumla modalı (slider), kriter ortalamaları + geçmiş, İl Onayı Ver (Manager), Adaylar sayfası (/il-panel/adaylar) |
| 6-10 | ⬜ Başlanmadı (plan §34) |

**Frontend aktif sayfalar:**
- `/` → `HomePage.tsx` — vitrin + CTA + arşiv modalı
- `/fikir` → `FikirPage.tsx`
  - oturum yoksa → `AuthModal` (kapatılamaz, Fikrini Anlat teması, 4 satır × 2 sütun kayıt formu)
  - oturum varsa → kategori DB'den + 1.500 sayaç + Taslak Kaydet / Gönder + mevcut taslaklar listesi

**Paralel iş:** Netlify'daki statik prototip (`index.html`, `fikir.html`, `admin.html` +
`assets/`) yayında ve canlı demo olarak kullanılıyor. Yeni gerçek uygulama `frontend/` +
`backend/` altında ayrı büyüyor. İkisi birbirinden bağımsız; prototipe dokunulmuyor.

---

## Ortam bilgileri (bu makineye özel)

- **Veritabanı:** PostgreSQL 18 **doğrudan kuruldu** (Docker kullanılmıyor).
  Bağlantı: `Host=localhost;Port=5432;Database=fikir_platformu;Username=postgres`
  Şifre: `backend/src/FikirPlatformu.Api/appsettings.json` içinde (yerel geliştirme şifresi, üretime çıkmaz).
- **PostgreSQL başlatma (PC yeniden başladıysa):** kurulum servisi kaydetmeden yapıldı,
  elle başlatılır: `& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" start`
  (Kalıcı çözüm: yönetici PowerShell'de `pg_ctl register -N postgresql-x64-18 -D "C:\Program Files\PostgreSQL\18\data"`)
- **Backend çalıştırma:** `dotnet run --project backend/src/FikirPlatformu.Api` → http://localhost:5000
- **Frontend çalıştırma:** `cd frontend && pnpm dev` → http://localhost:5173 (`/api` proxy'si 5000'e gider)
- **Tüm kontroller:** `powershell -File scripts/verify.ps1`
- **Migration oluşturma:** `cd backend && dotnet ef migrations add <Ad> --project src/FikirPlatformu.Infrastructure --startup-project src/FikirPlatformu.Api`
- **Migration uygulama:** aynı komutla `... database update`
- **Geliştirme e-postaları:** `backend/src/FikirPlatformu.Api/dev-email/` klasörüne dosya olarak yazılır
  (doğrulama/sıfırlama bağlantıları burada — token içerdiği için git'e girmez)
- **Yükleme paketi:** `Fikir_Platformu_yukle_yeni.zip` (statik prototip Netlify paketi — prototip değişince yenilenir)

---

## Tamamlanan aşamaların özeti

### Aşama 0 — Gereksinim mutabakatı
- Plan dokümanı (40 bölüm) oluşturuldu; kesinleşen kararlar §3'te.
- Aşama 2 kararları §41'e işlendi (zorunlu alanlar, il değişikliği serbest, okul/ilçe serbest metin,
  çerez kimliği, e-posta doğrulama zorunlu, şifre politikası, roller).

### Aşama 1 — Teknik temel
- `backend/`: Domain / Application / Infrastructure / Api katmanları.
  - `Idea` entity (1.500 karakter kuralı + taslak/gönderim durumu, Domain/Ideas)
  - `SubmitIdeaService` + `IIdeaRepository` + `IProfanityFilter` arayüzleri (uygulama Aşama 3'te)
  - `IClock`, `IEmailSender`, `IFileStorage`, `IDocumentGenerator` arayüzleri (taşınabilirlik)
  - `FikirPlatformuDbContext` + `/api/health` + `/api/health/db` uçları
- `frontend/`: React + TypeScript + Vite iskeleti, health API istemcisi, netlify.toml (frontend klasörüne özel), vite proxy
- `compose.yaml` (PostgreSQL 18 — Docker alternatifi), `scripts/verify.ps1` (tek komutla tüm kontroller)

### Aşama 2 — Kimlik ve öğrenci profili (backend)
- ASP.NET Core Identity, **HttpOnly çerez** kimliği (localStorage token yasak — plan §8.4)
- `ApplicationUser` (Ad/Soyad alanlı), roller: Student, ProvinceEvaluator, ProvinceManager, MinistryOfficial, SystemAdmin
- Uçlar: `POST /api/auth/register`, `GET /api/auth/verify-email`, `POST /api/auth/login` (RequireConfirmedAccount=true),
  `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`,
  **`GET /api/auth/me`** (AllowAnonymous; oturum varsa profil bilgisiyle döner)
- `GET/PUT /api/profile` (il güncellenebilir; okul/ilçe/sınıf/no serbest metin) — şu an frontend tüketmiyor
- `GET /api/reference/provinces` (81 il, plaka kimlikli) + `GET /api/reference/categories` (10 kategori)
- Geliştirme e-postaları `dev-email/` klasörüne yazılır (üretimde SMTP adaptörü takılacak)

### Aşama 2+ — Kimlik akışı (AuthModal, inline `/fikir`)
- `AuthModal.tsx` — Fikrini Anlat temalı kapatılamaz lightbox; Giriş ↔ Kayıt toggle
- `services/api.ts` — fetch wrapper, cookie auth (`credentials: 'include'`), `ApiHttpError`
- `services/auth.ts` — register/login/logout/me
- 4 satır × 2 sütun kayıt formu: Ad+Soyad, İl+Okul Adı, Sınıf+Okul No, E-posta+Şifre
- Erişilebilirlik paneli z-index 100/101 (modal overlay 96 üstünde — modal açıkken de çalışır)
- Modal eni 40rem; tema-input (input) + tema-secim (select) ayrımı
- AuthModal hata mesajı gerçek API body'sini gösteriyor (errors dict veya message)

### Aşama 3 — Fikir girişi (backend tamam)
- Öğrenciye özel uçlar: taslak oluşturma/güncelleme, gönderme, listeleme, detay ve taslak silme.
- Fikir ili istemciden alınmıyor; gönderim anındaki öğrenci profilinden fikre kopyalanıyor.
- Aktif kategori kontrolü taslak oluşturma, güncelleme ve gönderimde backend tarafından yapılıyor.
- 1.500 karakter sınırı boşluk ve noktalama dâhil backend üzerinde uygulanıyor.
- Boş taslak kaydedilebiliyor ancak gönderilemiyor; minimum karakter kararı henüz verilmedi.
- Yapay zekâsız küfür filtresi: Türkçe normalleştirme, basit rakam/harf dönüşümleri,
  nokta-tire-boşlukla ayırma ve aşırı harf tekrarlarına karşı eşleştirme.
- `blocked_terms` tablosu `Block` ve ileride kullanılabilecek `Flag` seviyelerini destekliyor.
- İnternet listesi doğrudan aktarılmadı; lisans ve yanlış pozitif incelemesinden sonra kurumca
  onaylanan liste veritabanına yüklenecek.
- `IdeaSubmissionAndModeration` migration'ı yerel PostgreSQL'e uygulandı.
- xUnit test projesi eklendi; `scripts/verify.ps1` artık testleri de çalıştırıyor.
- **Otomatik test:** 17/17 birim testi ✓
- **Uçtan uca test:** kayıt/doğrulama/giriş → 1.500 sınırı → taslak → il değişikliği →
  gönderim → filtre engeli → boş gönderim engeli → listeleme → taslak silme ✓

### Aşama 3 — Fikir girişi (frontend tamam)
- `FikirPage.tsx` yeniden yazıldı; backend'e bağlı.
- Sayfa açılınca `/api/auth/me` ile oturum kontrolü; yoksa AuthModal açılır (form blur'lu arka planda).
- Kategori dropdown `/api/reference/categories`'tan (10 kategori).
- İl/öğrenci bilgileri **frontend'de yok** — backend öğrencinin profilinden (`StudentProfile` + `AspNetUsers`)
  alıyor; fikir gönderildiğinde `province_id` profile kopyalanır (plan §8.2, §42 #1).
- Canlı 1.500 karakter sayacı (frontend UX; backend doğrular).
- "Taslak Kaydet" + "Fikrimi Gönder 🚀" butonları, taslak değiştirilebilir; gönderim sonrası süreç
  takibi stepper'ı korundu (Gönderildi → Ön Değerlendirme → Komisyon → Planlama → Hayata Geçirildi).
- Mevcut taslaklar listesi: kategori, içerik özeti, durum etiketi, Düzenle / Sil işlemleri.

---

## Sıradaki adımlar (gerçek sıra)

1. **Aşama 6 — Bakanlık paneli (MinistryOfficial):**
   - 81 ilin aday havuzlarını toplar
   - Üç aylık dönemde her kategoriden bir fikir seçer
   - Planlama/Hayata Geçirme akışı
2. **Production'a hazırlık:**
   - `ProvinceStaff` tablosu (plan §42 #3) — manager/evaluator'lar gerçek ile bağlanır
   - SMTP e-posta adaptörü (development → üretim)
   - CORS üretim ayarları
3. **Küfür listesi veri çalışması:** aday listenin kurumca incelenmesi, yanlış pozitiflerin
   çıkarılması ve onaylanan sürümün `blocked_terms` tablosuna yüklenmesi.
4. Açık kararlar (plan §37):
   - Minimum fikir uzunluğu
   - Ekip özelliğinin ilk sürüme girip girmeyeceği
   - Filtrenin `Flag` seviyesinin ilk sürümde etkin olup olmayacağı
   - Tek veya çoklu değerlendirici zorunluluğu (eşik/karar)
   - Adaylık puan eşiği (somut sayı — şimdilik 3.5)
   - Değerlendirme kriterlerinin kesin adları ve puanlama türleri (4 kriter × 1-5; sabit)

### Tamamlanan: Aşama 4 — İl AR-GE paneli

**Backend:**
- `idea_read_receipts` + `idea_assignments` tabloları (migration)
- `/api/province/inbox` (gönderilmiş fikirler + okundu/atanmış bilgisi)
- `/api/province/ideas/{id}` (detay)
- `/api/province/ideas/{id}/read` (kullanıcı bazlı okundu)
- `/api/province/ideas/{id}/assign` (sadece ProvinceManager)
- `/api/province/evaluators` (değerlendirici listesi)
- Seed: `manager@local` (ProvinceManager) + `evaluator@local` (ProvinceEvaluator) — şifre `12345`, İstanbul ili

**Frontend:**
- `services/province.ts` — getInbox, getProvinceIdea, markRead, assignEvaluator, listEvaluators
- `pages/ProvinceInboxPage.tsx` — gelen kutusu tablosu, yeni/okundu badge, tıklayınca detaya
- `pages/ApplicationDetailPage.tsx` — detay, otomatik okundu işaretleme, "Değerlendiriciye Ata" modal (sadece Manager)
- Üst bar: rol bazlı "İl Paneli" linki + kullanıcı adı
- Detay placeholder: "Değerlendir (Aşama 5)" disabled

**Uçtan uca test (curl):** Öğrenci kayıt + emailConfirmed + login + taslak + submit → Manager login + inbox görür + detay + read + assign → Inbox atama bilgisiyle ✓

### Not: Ana sayfa ve görsel doğrulama (referans)
- Ana sayfa React'e birebir taşındı ✅: üst bar (logolar köşelerde), GELECEĞİN FİKRİ PLATFORMU
  başlığı (Rammetto One), Ayın Fikirleri vitrini (yan kartlar af-k-* sınıflarıyla, orta kart
  tıklanınca lightbox açılır), Fikrini Yaz & Paylaş CTA, alt şerit (Arşiv + Fark Yarat),
  arşiv modalı.
- Erişilebilirlik paneli tam sürüm korunuyor (koyu mod, ekran okuyucu + sayfayı oku/durdur,
  yazı boyutu A−/A/A+, disleksi, yüksek kontrast, bağlantıları vurgula, animasyonları durdur,
  sıfırla) — `AccessibilityPanel.tsx`.
- Son görsel doğrulama (1366×768 + 560×1080): üst boşluk ~140px, alt boşluk ~118px,
  içerik dikeyde dengeli ve ortalanmış.

---

## Karar günlüğü — Aşama 2+ / Aşama 3 frontend (2026-09-20)

Aşama 2+ (inline AuthModal) ve Aşama 3 frontend tamamlanırken aşağıdaki kararlar revize edildi:

1. **Kimlik akışı konumu (Aşama 2+):** Kayıt/giriş/profil akışı **ayrı sayfa** olarak değil,
   `/fikir` içinde **AuthModal** (kapatılamaz lightbox) olarak uygulandı. Anasayfadaki "Fikrini
   Paylaş" CTA'sı `/fikir`'e yönlendirir; modal Fikrini Anlat temasında açılır (turkuaz+turuncu
   balon, maskot, erişilebilirlik paneli modal açıkken de çalışır).
2. **Kayıt formu alanları (§41 #1 güncelleme):** Register uç artık şu alanları kabul ediyor:
   - **Zorunlu:** Ad, Soyad, İl, E-posta, Şifre (min 5 karakter)
   - **Opsiyonel:** Okul Adı, Sınıf (1–12), Okul No
   İlçe hâlâ sonra (profil güncellemesinden). Backend `StudentProfile.School/Grade/StudentNumber`
   alanları opsiyonel string/int olarak kaydediliyor.
3. **Şifre politikası (§41 #6 güncelleme):** Identity default'ları (büyük harf, küçük harf, rakam,
   özel karakter) **kapatıldı**. Sadece `RequiredLength = 5` kaldı. Sebep: hedef kitle küçük
   çocuklar; karmaşık kuralları beceremez. 5 hatalı giriş → 15 dakika kilit aynen korunuyor.
4. **Öğrenci bilgileri frontend'de yok (plan §42 #1 uygulandı):** İl, okul, sınıf, okul no
   alanları `FikirPage` formundan **kaldırıldı**; backend öğrencinin `StudentProfile`'ından
   alıyor. Fikir gönderildiğinde `province_id` profile kopyalanır.

### Karar günlüğü — Aşama 4 (2026-09-20)

5. **İl AR-GE il bağlantısı (plan §42 #3 kısmi):** Bu sprint'te kullanıcının hangi ile bağlı
   olduğu `AspNetUsers` tablosunda tutulmamaktadır (plan §42 #3 için ayrı tablo gerekli).
   Geçici olarak tüm `ProvinceManager`/`ProvinceEvaluator` demo hesapları **İstanbul (id 34)**
   ile ilişkilendirilmiştir. `GetProvinceForStaffAsync` helper'ı bu sabit döner; gerçek atama
   yapıldığında helper değişecektir. Production'a geçmeden önce ayrı `ProvinceStaff` tablosu
   (user_id, province_id) eklenmelidir.
6. **Değerlendirme adayı ataması:** Bir fikre birden fazla evaluator atanabilir (şu an UI tek
   seçim gösterir; `idea_assignments` tablosu çoklu atamayı destekler). Çoklu zorunluluk
   kararı henüz verilmedi (plan §37 açık).
7. **Okundu işaretleme:** Detay sayfası açılır açılmaz otomatik olarak kullanıcı bazında
   okundu işaretlenir (`POST /api/province/ideas/{id}/read`). Bu sayede inbox badge'i
   güncel kalır.

### Karar günlüğü — Aşama 5 (2026-09-20)

8. **Değerlendirme kriterleri (plan §20, §37):** 4 kriter sabitlendi — Yenilikçilik,
   Uygulanabilirlik, Etki, Özgünlük. Puanlama **1-5 arası tam sayı** (5 = en iyi).
   İleride kriter ağırlıkları veya ek kriterler eklenirse karar günlüğüne işlenir.
9. **Adaylık puan eşiği (plan §22, §37):** Sabit **3.5**. Bir fikir tüm kriterlerin ortalaması
   bu eşiği geçerse otomatik `EvaluationCompleted` olur ve aday havuzunda görünür. Eşik
   değeri şimdilik sabit; yönetim panelinden yapılandırılabilir hale getirmek Aşama 6'da
   değerlendirilir.
10. **Çoklu değerlendirici (plan §37):** Şimdilik **tek evaluator yeterli** (ilk gönderen
    puanlama durum geçişini tetikler). `idea_evaluations` tablosu çoklu evaluator'u
    destekler (composite key sayesinde). Çoklu zorunluluk kararı sonra verilecek.
11. **Durum geçişleri (plan §17-18, §22-23):**
    - Submitted → InEvaluation: ilk puanlama geldiğinde
    - InEvaluation → EvaluationCompleted: ortalama ≥ 3.5 olduğunda (aynı Submit çağrısında)
    - EvaluationCompleted → Locked: ProvinceManager onayı
    - Locked: artık puanlama kabul edilmez (400)

---

## Kural

Her önemli işten sonra:
1. Bu dosyadaki **"Bir bakışta durum"** tablosunu ve tarih satırını güncelle.
2. Tamamlanan işi "Tamamlanan aşamalar" altına madde madde ekle.
3. Yeni ortam bilgisi (kurulum, şifre konumu, port vb.) öğrendiysen "Ortam bilgileri"ne yaz.
4. `git commit` et.
Yeni oturumda ilk iş bu dosyayı okumak; son iş ise onu güncellemek.
