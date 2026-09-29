# Geleceğin Fikri Backend

ASP.NET Core 10 (`net10.0`) + EF Core 9 (Pomelo MySQL) tabanlı backend.
Çözüm: `FikirPlatformu.slnx`. SDK sürümü `global.json` ile `10.0.301`
(`rollForward: latestFeature`).

## Katmanlar ve paketler

| Proje | Sdk | Paketler |
|---|---|---|
| `src/FikirPlatformu.Domain` | `Microsoft.NET.Sdk` | — |
| `src/FikirPlatformu.Application` | `Microsoft.NET.Sdk` | — |
| `src/FikirPlatformu.Infrastructure` | `Microsoft.NET.Sdk` | `Pomelo.EntityFrameworkCore.MySql` 9.0.0, `Microsoft.AspNetCore.Identity.EntityFrameworkCore` 9.0.0, `Microsoft.AspNetCore.DataProtection.EntityFrameworkCore` 9.0.0, `Otp.NET` 1.4.1 |
| `src/FikirPlatformu.Api` | `Microsoft.NET.Sdk.Web` | `Microsoft.EntityFrameworkCore.Design` 9.0.0 |
| `tests/FikirPlatformu.Tests` | `Microsoft.NET.Sdk` | `Microsoft.NET.Test.Sdk` 18.10.1, `xunit` 2.9.3, `xunit.runner.visualstudio` 3.1.5 |

`backend/Directory.Build.props` tüm projelere `net10.0`, `Nullable` ve
`ImplicitUsings` verir; `TreatWarningsAsErrors` **kapalıdır** (backend'de açık
değil — kök `Directory.Build.props`'taki `true` burada ezilir).

`Infrastructure` altındaki klasörler: `Auth`, `Email`, `Identity`, `Migrations`
(3 migration: `InitialMySql`, `AddAuthSecurity`, `FixPasswordChangedAtType`),
`Moderation`, `Persistence` (+ `Configurations`, `Migrations`), `ReferenceData`,
`Security`, `Time`.

## Çalıştırma

```powershell
dotnet restore backend/FikirPlatformu.slnx
dotnet run --project backend/src/FikirPlatformu.Api
```

Bağlantı dizesi `ConnectionStrings__MySql` (yerelde `appsettings.json` ya da
user-secrets `9a375e7a-...`). Startup'ta `dbContext.Database.Migrate()`
çalışır (`Program.cs`). Sağlık kontrolü: `GET /api/health`, `GET /api/health/db`.

İlk sistem yöneticisi — **iki ayrı yol, ikisi de env'den okur, kodda gömülü değer yoktur**:

| Yol | Tetikleyici | Gerekli env |
|---|---|---|
| Açılışta otomatik (`Program.cs`) | Her açılışta çalışır; e-posta **zaten varsa hiçbir şey yapmaz** (şifre/MFA korunur) | `SeedSystemAdmin__Email` **ve** `SeedSystemAdmin__Password` (ikisi de tanımlı olmalı) |
| Kurulum aracı | `dotnet run --project backend/src/FikirPlatformu.Api -- seed` | `SEED_ADMIN_PASSWORD` (zorunlu), `SEED_ADMIN_EMAIL` (varsayılan `sistem.yoneticisi@kurum.local`) |

`seed` komutu **hedef veritabanı boş değilse hiçbir şey yazmadan çıkar** (fail-closed).
Her ikisi de `SystemAdmin` + `MinistryOfficial` rolleriyle hesap oluşturur;
kurulum sonrası bu değişkenler sunucudan kaldırılmalıdır.

## Kimlik doğrulama

Dört ayrı cookie scheme (hepsi HttpOnly, 30 dk idle + 8 saat mutlak süre;
`PreMfaScheme` 10 dk):

| Scheme | Cookie | Kullanım |
|---|---|---|
| `IdentityConstants.ApplicationScheme` | `.FikirStudent.Auth` | Öğrenci |
| `ProvinceScheme` | `.FikirProvince.Auth` | İl AR-GE personeli |
| `MinistryScheme` | `.FikirMinistry.Auth` | Bakanlık |
| `PreMfaScheme` | `.FikirPreMfa.Auth` | Şifre doğrulandı, MFA bekliyor |

Yetkilendirme politikaları: `StudentOnly`, `ProvinceOnly` (SystemAdmin dahil),
`MinistryOnly`, `PreMfaOnly`, `MfaCompleted`, `SystemAdminOnly`.

Parola yaşı (`Domain/Auth/SifreYasiPolicy.cs`): uyarı **75 gün**, zorunlu değişim
**90 gün**. Rol bazlı zorlama: `MinistryOfficial` zorunlu; `Student`,
`ProvinceEvaluator`, `ProvinceManager` tavsiye; `SystemAdmin` muaf.
`SameSite`, `Cors:AllowedOrigins` listesine göre: liste doluysa `None`,
boşsa `Lax`. `CORS` liste boşsa middleware hiç kurulmaz (same-origin modu).
Gömülü Render origin fallback'i Sprint 11.52'de kaldırıldı; ayrı-origin dağıtım
`Cors__AllowedOrigins` veya `Cors__AllowRenderFallback=true` ile opt-in.

MFA uçları (`Endpoints/MfaEndpoints.cs`, grup `/api/auth/mfa`):
`POST /setup`, `GET /method`, `POST /send-email-otp`, `POST /verify-setup`,
`POST /verify`, `POST /disable`, `POST /cancel`.

## Öğrenci fikir uçları (`Endpoints/StudentIdeaEndpoints.cs`)

- `GET /api/student/ideas`
- `GET /api/student/ideas/{id}`
- `POST /api/student/ideas/drafts`
- `PUT /api/student/ideas/drafts/{id}`
- `POST /api/student/ideas/{id}/submit`
- `DELETE /api/student/ideas/{id}` (yalnızca taslak)

Bu uçlar `Student` rolü ister. İl değeri istek gövdesinden alınmaz; gönderim
anında öğrenci profilinden kopyalanır.

## Yönetim uçları (`Endpoints/AdminEndpoints.cs`, grup `/api/admin`)

`GET|POST /users`, `GET|PUT|DELETE /users/{id}`, `POST /users/{id}/change-role`,
`POST /users/{id}/reset-mfa`, `POST /users/{id}/reset-password`, `POST /users/bulk`,
`GET /raporlar`, `GET /raporlar/{dosya}`, `GET /raporlar/{dosya}/indir`,
`GET /pasif-hesaplar`, `POST /pasif-hesaplar/tekrar-aktiflestir`.

`GET /users` rol filtresi beyaz listeye bağlıdır (`SystemAdmin`, `MinistryOfficial`,
`ProvinceManager`, `ProvinceEvaluator`); `Student` rollü kayıtlar listeden çıkarılır.
Toplu CSV yüklemesi `.csv` uzantısı + izinli MIME + başlık doğrulaması ister
(istemcinin gönderdiği uzantı/MIME tek başına güvenilmez).

Denetim raporları (`ArkaPlan/DenetimRaporServisi.cs`) her gece 02:00 UTC'de
JSONL + yöneticiye dönük CSV özeti üretir; klasör `DenetimRapor__Klasor`
(varsayılan göreli, Docker'da volume'a bağlanmalı), saklama `DenetimRapor__SaklamaGun`
(varsayılan 400).

## Bakım uçları

`/api/__maintenance/*` ve `/api/auth/__debug/*` uçları `AdminMaintenance__Secret`
ile korunur; değişken **tanımlı değilse 403 döner** (fail-closed). Sprint 12'de
kaldırılacak.

## Test

`tests/FikirPlatformu.Tests` — **xUnit, 23 test, 4 dosya**:

| Dosya | Test |
|---|---|
| `IdeaTests.cs` | 6 `[Fact]` |
| `SubmitIdeaServiceTests.cs` | 3 `[Fact]` |
| `Rfc2047Tests.cs` | 6 `[Fact]` (RFC 2047 encoded-word) |
| `ProfanityTextMatcherTests.cs` | 2 `[Theory]` × 4 `[InlineData]` = 8 |

Depo kökündeki `scripts/verify.ps1` (ve Linux için `scripts/verify.sh`) restore,
Release derleme, `dotnet test`, `pnpm install --frozen-lockfile`, `pnpm typecheck`
ve `pnpm build` adımlarını çalıştırır.

## Veritabanı

- **Üretim/demo:** TiDB Cloud (MySQL uyumlu, Frankfurt bölgesi)
- **Yerel self-hosted:** `docker-compose.yml` (MySQL 8.0) — `docker compose up -d`
  veya `docker compose --profile with-mysql up -d`
- PostgreSQL döneminden kalma `compose.yaml` **Sprint 11.52'de silindi**
  (`git log -- compose.yaml` → `cdf800f`); artık projede yok.

Provider `Pomelo.EntityFrameworkCore.MySql` 9.0.0, `SchemaBehavior.Ignore`
ile yapılandırılmış (migration'lardaki `public` şema referansı MySQL'de
geçersiz olduğu için). Data Protection anahtarları aynı DB'de
`data_protection_keys` tablosunda — TOTP secret'ları bunlarla şifrelenir,
veritabanı yedeği bu tabloyu da içermelidir.

Yerel geliştirme parolaları kodda tutulmaz; ortam değişkenleri veya
user-secrets kullanılır.
