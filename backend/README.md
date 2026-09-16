# Geleceğin Fikri Backend

ASP.NET Core 10 tabanlı, sağlayıcıdan bağımsız backend başlangıç yapısıdır.

## Katmanlar

- `Domain`: İş kuralları ve temel modeller
- `Application`: Kullanım senaryoları ve altyapı arayüzleri
- `Infrastructure`: Veritabanı, e-posta, dosya ve belge adaptörleri
- `Api`: HTTP API ve uygulama yapılandırması

## Çalıştırma

```powershell
dotnet restore backend/FikirPlatformu.slnx
dotnet run --project backend/src/FikirPlatformu.Api
```

Sağlık kontrolü: `GET /api/health`

## Yerel PostgreSQL

Depo kökündeki `compose.yaml`, geliştirme için PostgreSQL 18 başlatır:

```powershell
docker compose up -d postgres
```

Varsayılan kullanıcı bilgileri yalnızca yerel geliştirme içindir. Gerçek ortam bilgileri
kodda tutulmayacak; ortam değişkenleri veya YEĞİTEK'in sağlayacağı güvenli yapılandırma
mekanizması kullanılacaktır.
