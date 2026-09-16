# Proje Durumu — YENİ OTURUM AÇILDIGINDA ÖNCE BU DOSYAYI OKU

> Son güncelleme: 2026-09-16
> Ana plan: `docs/GELECEGIN_FIKRI_PROJE_PLANI.md` (40 bölüm + §41 karar günlüğü)
> Kaynak belge: `Fikir Platformu 11.08.2026.pdf`

Bu dosya, "hangi aşamadayız?" sorusunun tek kaynağıdır. Her önemli işten sonra
"Bir bakışta durum" bölümü güncellenir ve commit edilir.

---

## Bir bakışta durum

| Aşama | Durum |
|---|---|
| 0 — Gereksinim mutabakatı | ✅ Tamam (plan §3 kesinleşen kararlar) |
| 1 — Teknik temel ve depo düzeni | ✅ Tamam |
| 2 — Kimlik ve öğrenci profili | ✅ Tamam (uçtan uca test edildi) |
| 2+ — Öğrenci arayüzü (React): kayıt/giriş/doğrulama/profil | ✅ Tamam (tarayıcıda uçtan uca doğrulandı) |
| 3 — Fikir girişi | 🟡 Backend + doğrulama tamam; fikir yazma arayüzü (Aşama 3 React) bekliyor |
| 4-10 | ⬜ Başlanmadı (plan §34) |

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

### Aşama 2 — Kimlik ve öğrenci profili
- ASP.NET Core Identity, **HttpOnly çerez** kimliği (localStorage token yasak — plan §8.4)
- `ApplicationUser` (Ad/Soyad alanlı), roller: Student, ProvinceEvaluator, ProvinceManager, MinistryOfficial, SystemAdmin
- Uçlar: `POST /api/auth/register`, `GET /api/auth/verify-email`, `POST /api/auth/login` (RequireConfirmedAccount=true),
  `POST /api/auth/logout`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `GET/PUT /api/profile` (il güncellenebilir; okul/ilçe/sınıf/no serbest metin)
- `GET /api/reference/provinces` (81 il, plaka kimlikli) + `GET /api/reference/categories` (10 kategori)
- Geliştirme e-postaları `dev-email/` klasörüne yazılır (üretimde SMTP adaptörü takılacak)
- **Uçtan uca test edildi:** kayıt → doğrulama → giriş → profil oku → profil güncelle → çıkış → 401 ✓

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

## Sıradaki adımlar (plan sırasıyla)

1. ~~Aşama 2 arayüzü (React)~~ ✅ TAMAMLANDI: kayıt/giriş/şifre akışları/profil/panel + erişilebilirlik paneli React'e taşındı; tarayıcıda uçtan uca doğrulandı (kayıt → doğrulama → giriş → panel → profil).
2. **Aşama 3 arayüzü (SIRADAKİ):** kategori seçimi, canlı 1.500 karakter sayacı, taslaklar ve süreç takibi.
3. **Küfür listesi veri çalışması:** aday listenin kurumca incelenmesi, yanlış pozitiflerin
   çıkarılması ve onaylanan sürümün `blocked_terms` tablosuna yüklenmesi.
4. Açık kararlar: minimum fikir uzunluğu, ekip özelliğinin ilk sürüme girip girmeyeceği ve
   filtrenin `Flag` seviyesinin ilk sürümde etkin olup olmayacağı.

---

## Kural

Her önemli işten sonra:
1. Bu dosyadaki **"Bir bakışta durum"** tablosunu ve tarih satırını güncelle.
2. Tamamlanan işi "Tamamlanan aşamalar" altına madde madde ekle.
3. Yeni ortam bilgisi (kurulum, şifre konumu, port vb.) öğrendiysen "Ortam bilgileri"ne yaz.
4. `git commit` et.
Yeni oturumda ilk iş bu dosyayı okumak; son iş ise onu güncellemek.
