# Proje Durumu — YENİ OTURUM AÇILDIGINDA ÖNCE BU DOSYAYI OKU

> Son güncelleme: 2026-09-19
> Ana plan: `docs/GELECEGIN_FIKRI_PROJE_PLANI.md` (40 bölüm + §41–42 karar günlüğü)
> Kaynak belge: `Fikir Platformu 11.08.2026.pdf`

Bu dosya, "hangi aşamadayız?" sorusunun tek kaynağıdır. Her önemli işten sonra
"Bir bakışta durum" bölümü güncellenir ve commit edilir.

> **ÖNEMLİ — kullanıcı kararı (2026-09-19):** React tarafındaki kayıt / giriş / doğrulama /
> profil / şifre akışları **kaldırıldı**. Kullanıcı bunlar istediği gibi yapılmadığı için
> sildi. Backend Identity uçları kodda duruyor (AuthEndpoints, ProfileEndpoints) fakat
> frontend tarafından tüketilmiyor. Yeni uygulamada şu an **yalnız iki sayfa** var:
> `HomePage` (/) ve `FikirPage` (/fikir). Aşama 2 frontend tarafında **iptal edildi**;
> yalnız Aşama 3 backend + Aşama 3 frontend kalıyor.

---

## Bir bakışta durum

| Aşama | Durum |
|---|---|
| 0 — Gereksinim mutabakatı | ✅ Tamam (plan §3 kesinleşen kararlar) |
| 1 — Teknik temel ve depo düzeni | ✅ Tamam |
| 2 — Kimlik ve öğrenci profili (backend) | 🟡 Backend Identity uçları var (AuthEndpoints, ProfileEndpoints); frontend tarafından tüketilmiyor |
| 2+ — Öğrenci arayüzü (React: kayıt/giriş/doğrulama/profil) | ❌ İptal (kullanıcı kaldırdı — istediği gibi yapılmadığı için) |
| 2++ — Ana sayfa React'e taşındı (index.html birebir kopya) | ✅ Tamam |
| 3 — Fikir girişi (backend) | ✅ Tamam (17/17 birim testi + uçtan uca) |
| 3 — Fikir girişi (frontend) | 🟡 Form var (`FikirPage.tsx`) fakat backend'e bağlı değil; gönder tuşu sadece UI toggle |
| 4-10 | ⬜ Başlanmadı (plan §34) |

**Frontend aktif sayfalar (onaylanan durum):**
- `/` → `HomePage.tsx` — vitrin + CTA + arşiv modalı
- `/fikir` → `FikirPage.tsx` — tema + öğrenci bilgileri + 1.500 sayaç (henüz backend'e yazmıyor)

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
  `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET/PUT /api/profile` (il güncellenebilir; okul/ilçe/sınıf/no serbest metin)
- `GET /api/reference/provinces` (81 il, plaka kimlikli) + `GET /api/reference/categories` (10 kategori)
- Geliştirme e-postaları `dev-email/` klasörüne yazılır (üretimde SMTP adaptörü takılacak)
- **Frontend tüketicisi yok:** React tarafında kayıt/giriş/profil/şifre akışları 2026-09-19'da kaldırıldı.
  Backend uçları kodda duruyor fakat şu an hiçbir sayfa bunları çağırmıyor. Aşama 2 frontend
  iptal edildi; bu uçlar ileride tekrar gerekirse ya yeniden yazılır ya da farklı bir karar verilir.

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

---

## Sıradaki adımlar (gerçek sıra)

1. **Aşama 3 frontend'i backend'e bağla (SIRADAKİ):**
   - `FikirPage.tsx` → `GET /api/reference/categories` (kategori dropdown DB'den)
   - `GET /api/student/ideas` (mevcut taslaklar + gönderilenler)
   - `POST /api/student/ideas/drafts` (taslak kaydet)
   - `PUT /api/student/ideas/drafts/{id}` (taslak güncelle)
   - `POST /api/student/ideas/{id}/submit` (gönder)
   - `DELETE /api/student/ideas/{id}` (taslak sil)
   - Canlı 1.500 karakter sayacı (frontend UX, backend doğrular)
   - Gönderim sonrası süreç takibi ekranı
2. **Aşama 2 frontend yeniden açılır mı?** Açılmadı sürece Identity uçları kullanılmıyor;
   karar kullanıcıya ait. Şu an gündemde değil.
3. **Küfür listesi veri çalışması:** aday listenin kurumca incelenmesi, yanlış pozitiflerin
   çıkarılması ve onaylanan sürümün `blocked_terms` tablosuna yüklenmesi.
4. Açık kararlar (plan §37):
   - Minimum fikir uzunluğu
   - Ekip özelliğinin ilk sürüme girip girmeyeceği
   - Filtrenin `Flag` seviyesinin ilk sürümde etkin olup olmayacağı
   - Tek veya çoklu değerlendirici zorunluluğu
   - Adaylık puan eşiği
   - Değerlendirme kriterlerinin kesin adları ve puanlama türleri

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

## Kural

Her önemli işten sonra:
1. Bu dosyadaki **"Bir bakışta durum"** tablosunu ve tarih satırını güncelle.
2. Tamamlanan işi "Tamamlanan aşamalar" altına madde madde ekle.
3. Yeni ortam bilgisi (kurulum, şifre konumu, port vb.) öğrendiysen "Ortam bilgileri"ne yaz.
4. `git commit` et.
Yeni oturumda ilk iş bu dosyayı okumak; son iş ise onu güncellemek.
