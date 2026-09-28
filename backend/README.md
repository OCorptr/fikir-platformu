# Geleceğin Fikri Backend

ASP.NET Core 10 + EF Core 9 (Pomelo MySQL) tabanlı backend.

## Katmanlar

- `Domain`: İş kuralları ve temel modeller
- `Application`: Kullanım senaryoları ve altyapı arayüzleri
- `Infrastructure`: Veritabanı (EF Core + Migrations), e-posta, dosya ve belge adaptörleri
- `Api`: HTTP API ve uygulama yapılandırması
- `tests/FikirPlatformu.Tests`: xUnit birim testleri (17 test)

## Çalıştırma

```powershell
dotnet restore backend/FikirPlatformu.slnx
dotnet run --project backend/src/FikirPlatformu.Api
```

Sağlık kontrolü: `GET /api/health` ve `GET /api/health/db`

**Not:** Backend startup'ta `Database.Migrate()` otomatik çalışır. Bağlantı dizesi
`ConnectionStrings__MySql` env ile verilir (local'de `user-secrets`).

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

## Veritabanı

- **Üretim/demo:** TiDB Cloud (MySQL-compatible, Frankfurt)
- **Yerel self-hosted:** `docker-compose.yml` (MySQL) — `docker compose up -d`
- ⚠️ Depo kökündeki `compose.yaml` Sprint 1-2'den kalma **PostgreSQL 18** tanımı içerir;
  uygulama MySQL kullandığı için **kullanma**.

Yerel geliştirme parolaları kodda tutulmaz; ortam değişkenleri veya user-secrets kullanılır.
