# YEĞİTEK Teslimi — Onay Bekleyen Bilgiler

> **Durum:** Bu bilgiler Onur tarafından teyit edilmedi. Teslim öncesi doldurulmalı.
> Bilinmeden tahmin edilip yazılan her değer **aşağıda listelidir** ve teslim
> paketinde o haliyle durur. Onur bilgileri verdiğinde tüm dosyalar
> `fikir.meb.gov.tr` kalıbıyla birlikte güncellenecektir.

Son güncelleme: Sprint 11.55

---

## ⏳ Bekleyen bilgiler

| # | Bilgi | Şu anki durum | Dosyalarda nerede |
|---|---|---|---|
| 1 | **Kurumun alan adı** | Tahmin: `fikir.meb.gov.tr` | `DEPLOYMENT.md` (20+ yer), `.env.example`, `frontend/README.md` |
| 2 | **Veritabanı sunucu adresi** | Tahmin: `mysql.fikir.meb.gov.tr` | `.env.example` (`DB_CONNECTION_STRING`) |
| 3 | **Sistem yöneticisi hesabının görünen adı** | Şu an: `Sistem` `Yöneticisi` | `KurulumSeedAraci.cs`, `Program.cs` (startup seed) |
| 4 | **Sunucu kurulum yolu** | Tahmin: `/opt/fikir-platformu/` | `DEPLOYMENT.md` (nginx `root`, systemd `WorkingDirectory`) |
| 5 | **Gönderen e-posta adresi** | Boş (`CHANGE_ME`) | `.env.example` (`MAIL__GMAIL__SENDERADDRESS`) |
| 6 | **Gmail mi SMTP mi?** | İkisi de destekleniyor, varsayılan Gmail | `.env.example` bölüm 4 |

## ✅ Onaylanmış (tarafından verildi)

| Bilgi | Değer |
|---|---|
| Sistem yöneticisi e-postası | `fikir.platformu.iletisim@gmail.com` |
| Kurulum parolası | `Bilisim35sse.` (`.env.example` içinde) |

---

## Neden tahmin yazıldı?

`.env` şablonu ve dokümantasyon geçerli olmak için bir değere ihtiyaç duyuyor.
Boş bırakılırsa kurulum komutu hata verir ve kurulum ekibi "bu sistem
kurulamıyor" der.

Bu yüzden geçerli bir örnek yazıldı ve burada **açıkça listelendi**. Onay
geldiğinde tek komutla değiştirilecek.

## Değiştirme sırası (bilgiler gelince)

1. `fikir.meb.gov.tr` → gerçek alan adı (tüm dosyalar)
2. `mysql.fikir.meb.gov.tr` → gerçik DB adresi
3. `/opt/fikir-platformu/` → gerçek kurulum yolu
4. `Sistem` / `Yöneticisi` → gerçek ad soyad
5. `curl https://<yeni-adres>/api/health` ile doğrula

---

*Bu dosya teslim öncesi silinmeli veya boşaltılmalı.*
