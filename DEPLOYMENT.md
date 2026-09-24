# YEĞİTEK Kurulum Rehberi

Bu doküman, geliştirme süreci tamamlandıktan sonra **Geleceğin Fikri Platformu**'nun kendi sunucularınızda kurulumu için hazırlanmıştır.

## 📋 Sistem gereksinimleri

| Bileşen | Minimum | Önerilen |
|---|---|---|
| **İşletim sistemi** | Windows Server 2019 / Ubuntu 20.04 | Windows Server 2022 / Ubuntu 22.04 LTS |
| **.NET Runtime** | .NET 10.0 SDK + Runtime | (kurulum setup'ında .NET 10 yükleyici var) |
| **Node.js** | 20.x LTS | 22.x LTS (pnpm için) |
| **Veritabanı** | MySQL 8.0+ / TiDB / MariaDB 10.6+ | TiDB Cloud (ücretsiz 5 GB) |
| **Web sunucu** | IIS 10+ (Windows) / nginx 1.20+ (Linux) | nginx + Let's Encrypt SSL |
| **RAM** | 1 GB | 2 GB |
| **CPU** | 1 core | 2 core |

---

## 🏗️ Önerilen mimari: Aynı domain + reverse proxy

```
                  ┌─────────────────────────────────┐
                  │   fikir.meb.gov.tr (HTTPS 443) │
                  └──────────────┬──────────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │       nginx reverse proxy     │
                  └──────┬───────────────────┬────┘
                         │ /                 │ /api/*
                         ▼                   ▼
         ┌───────────────────────┐   ┌───────────────────────┐
         │  Frontend (statik)    │   │  Backend .NET (5000) │
         │  dist/ klasörü        │   │  ASP.NET Core API     │
         └───────────────────────┘   └──────────────┬────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────────┐
                                        │   MySQL/TiDB (3306) │
                                        └─────────────────────┘
```

**Neden aynı domain:**
- Cookie auth same-origin (SameSite=Lax yeterli, SameSite=None gereksiz)
- CORS middleware gerekmez
- Tek SSL sertifikası
- Standart pattern (MEB siteleri için yaygın)

---

## 📁 Dizin yapısı (sunucuda)

```
/opt/fikir-platformu/                  (veya C:\fikir-platformu\)
├── backend/
│   ├── src/FikirPlatformu.Api/         ← dotnet publish çıktısı buraya
│   ├── appsettings.Production.json     ← (opsiyonel, env vars önerilir)
│   ├── Dockerfile                     ← (container için, IIS/nginx değil)
│   └── Directory.Build.props
├── frontend/
│   ├── dist/                          ← vite build çıktısı (nginx serve eder)
│   └── .env.production                ← opsiyonel, VITE_API_BASE_URL için
├── nginx/
│   └── fikir.meb.gov.tr.conf           ← reverse proxy config (örnek aşağıda)
├── deploy/
│   └── migrate.sh                     ← EF migrations uygulama scripti
└── README.md
```

---

## 🚀 Kurulum adımları

### 1) Veritabanı hazırlığı

```sql
-- MySQL 8.0 veya TiDB'de
CREATE DATABASE fikir_platformu CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'fikir_app'@'%' IDENTIFIED BY 'GUCLU_SIFRE_BURAYA';
GRANT ALL PRIVILEGES ON fikir_platformu.* TO 'fikir_app'@'%';
FLUSH PRIVILEGES;
```

### 2) Backend derleme (geliştirme makinesinde)

```bash
cd backend
dotnet publish src/FikirPlatformu.Api/FikirPlatformu.Api.csproj \
  -c Release \
  -o ./publish
```

`publish/` klasörünü sunucuya taşı (ör. `/opt/fikir-platformu/backend/publish`).

### 3) Frontend derleme (geliştirme makinesinde)

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm run build
# dist/ klasörünü sunucuya taşı
```

### 4) Backend environment variables (sunucuda)

`systemd` service veya IIS application pool'a environment variable olarak ekle:

| Değişken | Açıklama | Örnek |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` |
| `ASPNETCORE_URLS` | Bind adresi | `http://127.0.0.1:5000` |
| `ConnectionStrings__MySql` | DB bağlantısı | `Server=db.fikir.meb.gov.tr;Port=3306;Database=fikir_platformu;User=fikir_app;Password=GUCLU_SIFRE;SslMode=Required;` |
| `Frontend__BaseUrl` | verify-email link'leri için | `https://fikir.meb.gov.tr` |
| `Cors__AllowedOrigins__0` | Cross-origin ise | (BOŞ bırak aynı domain için) |
| `Cors__AllowedOrigins__0` | Frontend ayrı domain | `https://fikir-app.meb.gov.tr` |

> ⚠️ **Aynı domain** mimarisinde `Cors__AllowedOrigins__0` **boş** olmalı. Sistem otomatik olarak `SameSite=Lax` cookie ve CORS'sız çalışır.
>
> **Cross-origin** gerekirse (ör. frontend ayrı subdomain'de) bu değeri doldurun — sistem `SameSite=None; Secure` cookie'ye geçer.

### 5) Nginx reverse proxy örneği

`/etc/nginx/sites-available/fikir.meb.gov.tr.conf`:

```nginx
# HTTP → HTTPS yönlendirme
server {
    listen 80;
    server_name fikir.meb.gov.tr;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fikir.meb.gov.tr;

    ssl_certificate     /etc/letsencrypt/live/fikir.meb.gov.tr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fikir.meb.gov.tr/privkey.pem;

    # Güvenlik header'ları (ek savunma katmanı)
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # ---- Frontend (statik dosyalar) ----
    root /opt/fikir-platformu/frontend/dist;
    index index.html;

    # SPA fallback — tüm route'lar index.html'e düşer (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Statik asset cache (Vite hash'li dosyalar)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ---- Backend API ----
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";  # keep-alive için
        proxy_buffering off;
        proxy_read_timeout 60s;
    }

    # ---- Sağlık kontrolü ----
    location /api/health {
        proxy_pass http://127.0.0.1:5000;
        access_log off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fikir.meb.gov.tr.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6) Backend systemd service

`/etc/systemd/system/fikir-api.service`:

```ini
[Unit]
Description=Geleceğin Fikri API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fikir-platformu/backend/publish
ExecStart=/usr/bin/dotnet /opt/fikir-platformu/backend/publish/FikirPlatformu.Api.dll
Restart=always
RestartSec=10
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://127.0.0.1:5000
Environment=ConnectionStrings__MySql=Server=db.fikir.meb.gov.tr;Port=3306;Database=fikir_platformu;User=fikir_app;Password=GUCLU_SIFRE;SslMode=Required;
Environment=Frontend__BaseUrl=https://fikir.meb.gov.tr
# Cors:AllowedOrigins BOŞ — same-origin reverse proxy

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fikir-api
sudo systemctl status fikir-api
```

### 7) EF Migration'larını uygula

Sunucuda, backend klasöründe:

```bash
cd /opt/fikir-platformu/backend
# user-secrets'e connection string'i yaz (systemd yerine alternatif)
dotnet user-secrets set "ConnectionStrings:MySql" "Server=...;..." --project src/FikirPlatformu.Api

# Migration uygula (tabloları oluştur)
dotnet ef database update --project src/FikirPlatformu.Infrastructure --startup-project src/FikirPlatformu.Api
```

Veya doğrudan Publish klasöründeki connection string ile:

```bash
ConnectionStrings__MySql="Server=..." dotnet FikirPlatformu.Api.dll --migrate
```

(Backend kodu otomatik migration çalıştırmaz — bu adım Manuel/Deploy script'inde yapılmalı)

### 8) İlk admin kullanıcı

DB'ye direkt seed veya ilk giriş sonrası ASP.NET Identity `UserManager` ile:

```sql
INSERT INTO AspNetUsers (Id, UserName, NormalizedUserName, Email, NormalizedEmail,
    EmailConfirmed, PasswordHash, SecurityStamp, ConcurrencyStamp,
    PhoneNumberConfirmed, TwoFactorEnabled, LockoutEnabled, AccessFailedCount,
    FirstName, LastName, MustChangePassword)
VALUES (UUID(), 'admin@fikir.meb.gov.tr', 'ADMIN@FIKIR.MEB.GOV.TR',
    'admin@fikir.meb.gov.tr', 'ADMIN@FIKIR.MEB.GOV.TR', 1,
    -- PBKDF2 hash of "Demo1234!" (ASP.NET Identity v3)
    'AQAAAAIAAYagAAAAEKx...', -- Generate via dotnet user-secrets
    UUID(), UUID(), 0, 0, 1, 0, 'Sistem', 'Admin', 0);

INSERT INTO AspNetUserRoles (UserId, RoleId)
SELECT u.Id, r.Id FROM AspNetUsers u, AspNetRoles r
WHERE u.Email='admin@fikir.meb.gov.tr' AND r.Name='SystemAdmin';
```

**Önerilen:** Uygulamayı çalıştırıp `/giris` → "Kayıt Ol" formu ile ilk öğrenci hesabını aç, ardından SQL ile rol ata.

---

## 🔄 Güncelleme (yeni sürüm çıkınca)

```bash
# 1) Yeni kodu çek
cd /opt/fikir-platformu
git pull

# 2) Backend'i yeniden derle + yayınla
cd backend
dotnet publish src/FikirPlatformu.Api/FikirPlatformu.Api.csproj -c Release -o ./publish
sudo systemctl restart fikir-api

# 3) Frontend'i yeniden derle
cd ../frontend
pnpm install --frozen-lockfile
pnpm run build
# dist/ güncellendi — nginx reload gerekmez (statik dosya)
```

---

## 🛡️ Güvenlik notları

| Konu | Durum |
|---|---|
| Connection string | user-secrets veya env variable (kodda değil) |
| HTTPS | Let's Encrypt veya MEB iç sertifikası |
| Firewall | 443 (HTTPS) ve 22 (SSH) public; 5000 internal only |
| DB parolası | Minimum 24 karakter, rotasyon her 90 gün |
| Backup | DB günlük `mysqldump`, retain 30 gün |
| Log | `/var/log/fikir-api/` altında (retention 90 gün) |

---

## 📊 Mimari seçenekleri

### A) Aynı domain + nginx (önerilen — yukarıdaki setup)

| Avantaj | Dezavantaj |
|---|---|
| Cookie same-origin | Tek proxy ayarı |
| CORS yok | nginx konfigürasyon bilgisi gerekli |
| Tek SSL | |
| Basit deployment | |

### B) Cross-origin (ayrı subdomain'ler)

Kullanmak için **iki** değişiklik:

1. `appsettings.Production.json` veya env:
```json
"Cors": { "AllowedOrigins": ["https://fikir.meb.gov.tr"] }
```
2. `frontend/.env.production`:
```
VITE_API_BASE_URL=https://api.fikir.meb.gov.tr
```

| Avantaj | Dezavantaj |
|---|---|
| Backend ayrı ölçeklenebilir | CORS konfigürasyonu |
| Statik CDN'e taşınabilir | Cookie `SameSite=None; Secure` zorunlu |
| | Çift SSL sertifikası |

---

## ❓ Sorun giderme

| Sorun | Çözüm |
|---|---|
| `502 Bad Gateway` | `systemctl status fikir-api` — backend çalışıyor mu? |
| `423 Locked` (giriş) | DB'de `UPDATE AspNetUsers SET LockoutEnd=NULL WHERE Email='...'` |
| Migration hatası | `EnsureSchema("public")` ve `ascii_general_ci` → `utf8mb4_general_ci` regex ile düzelt, `dotnet ef database update` |
| CORS hatası | `Cors:AllowedOrigins` array dolu mu boş mu? Same-origin ise BOŞ olmalı |
| `Cannot find module` (frontend) | `pnpm install` çalıştır, `pnpm-lock.yaml` ile birebir |

---

## 📞 Destek

Geliştirici ekibi: **Onur** (Windows kernel driver developer — O-Freeze projesi)
Son güncelleme: 2026-09-24
GitHub: https://github.com/OCorptr/fikir-platformu