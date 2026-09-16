# Geleceğin Fikri Platformu

Bu depo iki uygulamayı geçici olarak birlikte barındırır:

- Kök dizindeki mevcut HTML/CSS/JavaScript dosyaları: Netlify'da çalışan prototip
- `frontend` ve `backend`: üretim uygulamasının yeni, taşınabilir temeli

Mevcut prototip kaldırılmamış veya değiştirilmemiştir. Yeni uygulama tamamlanıp kabul
edilene kadar iki yapı birbirinden bağımsız geliştirilebilir.

## Yerel geliştirme

Gereksinimler:

- .NET SDK 10
- Node.js 24 veya üzeri
- pnpm 11
- İsteğe bağlı olarak Docker/Podman (yerel PostgreSQL için)

PostgreSQL'i başlatmak için:

```powershell
docker compose up -d postgres
```

Backend'i başlatmak için:

```powershell
dotnet run --project backend/src/FikirPlatformu.Api
```

Frontend'i başlatmak için ikinci bir terminalde:

```powershell
Set-Location frontend
pnpm install
pnpm dev
```

Tüm derleme ve tip kontrolleri:

```powershell
./scripts/verify.ps1
```

Ürün ve teknik kararların ayrıntıları
[`docs/GELECEGIN_FIKRI_PROJE_PLANI.md`](docs/GELECEGIN_FIKRI_PROJE_PLANI.md)
dosyasındadır.
