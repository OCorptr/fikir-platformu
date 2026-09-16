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

## Öğrenci fikir uçları

- `GET /api/student/ideas`
- `GET /api/student/ideas/{id}`
- `POST /api/student/ideas/drafts`
- `PUT /api/student/ideas/drafts/{id}`
- `POST /api/student/ideas/{id}/submit`
- `DELETE /api/student/ideas/{id}` (şimdilik yalnızca taslak)

Bu uçlar `Student` rolü ister. İl değeri istek gövdesinden alınmaz; gönderim anında
öğrenci profilinden kopyalanır.

## Test

Depo kökündeki `scripts/verify.ps1`; restore, Release derleme, xUnit testleri,
frontend tip kontrolü ve frontend üretim derlemesini birlikte çalıştırır.

## Yerel PostgreSQL

Depo kökündeki `compose.yaml`, geliştirme için PostgreSQL 18 başlatır:

```powershell
docker compose up -d postgres
```

Varsayılan kullanıcı bilgileri yalnızca yerel geliştirme içindir. Gerçek ortam bilgileri
kodda tutulmayacak; ortam değişkenleri veya YEĞİTEK'in sağlayacağı güvenli yapılandırma
mekanizması kullanılacaktır.
