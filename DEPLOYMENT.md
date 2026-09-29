# YEĞİTEK Kurulum Rehberi

Bu doküman, geliştirme süreci tamamlandıktan sonra **Geleceğin Fikri Platformu**'nun kendi sunucularınızda kurulumu için hazırlanmıştır.

---

## ⚡ Hızlı başlangıç (30 dakikada kurulum)

İlk kez kurulum yapıyorsanız aşağıdaki adımları sırayla takip edin. Detaylar ilerleyen bölümlerde.

### A) Aynı domain + nginx reverse proxy (önerilen — Linux sunucu)

```bash
# 1) Proje dosyalarını sunucuya taşı
scp -r FikirPlatformu/ kullanici@sunucu:/opt/

# 2) MySQL veritabanı oluştur (kendi sunucunuzda)
mysql -u root -p
> CREATE DATABASE fikir_platformu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'fikir_app'@'localhost' IDENTIFIED BY 'GUCLU_SIFRE';
> GRANT ALL ON fikir_platformu.* TO 'fikir_app'@'localhost';
> FLUSH PRIVILEGES;
> EXIT;

# 3) Backend .env dosyası (sunucuda)
cd /opt/FikirPlatformu
cp .env.example .env
nano .env  # DB_CONNECTION_STRING düzenle

# 4) Backend yayınla + migration'ları çalıştır
cd backend
dotnet publish src/FikirPlatformu.Api -c Release -o /opt/fikir-api
# İlk çalıştırmada EF Core migration'lar otomatik uygulanır (Program.cs)
# Manuel kontrol: dotnet ef database update --project src/FikirPlatformu.Infrastructure

# 5) Frontend build
cd ../frontend
pnpm install --frozen-lockfile
pnpm run build  # VITE_API_BASE_URL boş → relative /api (nginx proxy'ler)

# 6) İlk sistem yöneticisi hesabı
#    .env'teki SeedSystemAdmin__Email + SeedSystemAdmin__Password ile oluşur (DB boşsa),
#    ya da elle:  cd backend && SeedSystemAdmin__Password='<güçlü>' dotnet run --project src/FikirPlatformu.Api -- seed
#    Diğer hesaplar (il yöneticisi, değerlendirici, öğrenci) uygulama içinden açılır.

# 7) systemd + nginx ayarla (Bölüm 5-6)
sudo systemctl enable --now fikir-api
sudo nginx -t && sudo systemctl reload nginx

# 8) Test: https://fikir.meb.gov.tr → "Yetkili Girişi" → .env'teki SeedSystemAdmin__Email / SeedSystemAdmin__Password
```

### B) docker-compose ile (kendi MySQL'in yoksa)

```bash
cd /opt/FikirPlatformu
cp .env.example .env
# .env'de DB_CONNECTION_STRING="Server=mysql;Port=3306;Database=fikir_platformu;User=fikir;Password=FikirGuclu2026!;SslMode=Preferred;"
docker compose --profile with-mysql up -d
# İlk sistem yöneticisi: .env'teki SEED_ADMIN_* değerleriyle otomatik oluşur (DB boşsa)
```

### C) Sadece backend + frontend (mevcut MySQL'iniz var)

```bash
cd /opt/FikirPlatformu
cp .env.example .env
nano .env  # DB_CONNECTION_STRING'i kendi MySQL'inize göre düzenle
docker compose up -d backend frontend
# İlk sistem yöneticisi: .env'teki SEED_ADMIN_* değerleriyle otomatik oluşur (DB boşsa)
```

---

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

**Temel (zorunlu):**

| Değişken | Açıklama | Örnek |
|---|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` |
| `ASPNETCORE_URLS` | Bind adresi | `http://127.0.0.1:5000` |
| `ConnectionStrings__MySql` | DB bağlantısı | `Server=db.fikir.meb.gov.tr;Port=3306;Database=fikir_platformu;User=fikir_app;Password=GUCLU_SIFRE;SslMode=Required;` |
| `Frontend__BaseUrl` | verify-email link'leri için | `https://fikir.meb.gov.tr` |
| `Cors__AllowedOrigins__0` | Cross-origin ise | (BOŞ bırak aynı domain için) |

**E-posta (Sprint 10 — MFA Email OTP için):**

| Değişken | Açıklama | Örnek |
|---|---|---|
| `Mail__Type` | `gmail` (OAuth2 HTTPS) / `resend` (HTTPS API) / boş (Development fallback) | `gmail` |
| `Mail__ApiKey` | Resend API key (sadece `Mail__Type=resend`) | `re_xxxxxxxx` |
| `Mail__Gmail__ClientId` | Google Cloud OAuth client ID | `xxx.apps.googleusercontent.com` |
| `Mail__Gmail__ClientSecret` | Google OAuth client secret | `GOCSPX-xxx` |
| `Mail__Gmail__RedirectUri` | Google'da tanımlı redirect URI ile **birebir aynı** olmalı | `https://fikir.meb.gov.tr/api/auth/gmail-oauth/callback` |
| `Mail__Gmail__SenderAddress` | Gönderen hesabın adresi | `noreply@fikir.meb.gov.tr` |
| `Mail__Gmail__SenderName` | Gönderici görünen adı | `Geleceğin Fikri` |
| `Mail__Host` | Özel SMTP host (opsiyonel) | `smtp.kurum.gov.tr` |
| `Mail__Port` | SMTP port | `587` |
| `Mail__User` | SMTP kullanıcı | (kurum SMTP credential) |
| `Mail__Pass` | SMTP şifre | (kurum SMTP credential) |
| `Mail__From` | SMTP From adresi | (kurum adresi) |
| `Mail__FromName` | SMTP From adı | `Geleceğin Fikri` |
| `AdminMaintenance__Secret` | `/api/__maintenance/*` + debug endpoint gizli anahtarı | (güçlü rastgele — Sprint 12'de kaldırılacak) |

> ✅ **Refresh token env'de tutulmaz.** Sprint 11.36'dan itibaren OAuth callback'i
> refresh token'ı PBKDF2 ile şifreleyip `gmail_refresh_tokens` tablosuna yazar
> (Id=1, sistem sabit). `Mail__Gmail__RefreshToken` env değişkenine **gerek yoktur**.
> Token expire olduysa `/admin/oauth` ekranından OAuth handshake'i tekrarla
> (bkz. `docs/GOOGLE-OAUTH-SETUP.md` ve `docs/runbook.md`).

> ⚠️ **Aynı domain** mimarisinde `Cors__AllowedOrigins__0` **boş** olmalı. Sistem otomatik olarak `SameSite=Lax` cookie ve CORS'sız çalışır.
>
> ⚠️ Sprint 11.52'den beri kod içinde **gömülü origin listesi yoktur**. `Cors__AllowedOrigins`
> boşsa CORS middleware hiç kurulmaz ve cookie'ler `SameSite=Lax` olur — same-origin
> reverse proxy kurulumu için bu doğru davranıştır. Ayrı-origin dağıtımda env'i
> **mutlaka** doldurun; aksi halde tarayıcı "CORS policy" hatası verir.
>
> **Cross-origin** gerekirse (ör. frontend ayrı subdomain'de) bu değeri doldurun — sistem `SameSite=None; Secure` cookie'ye geçer.
>
> **E-posta sağlayıcısı seçimi** (`Mail__Type`): Gmail OAuth2 (`gmail`) önerilir — port kısıtlaması yok, doğrudan Gmail hesabından mail gider. Kurum SMTP varsa da kullanılabilir. Detay için [`docs/GOOGLE-OAUTH-SETUP.md`](docs/GOOGLE-OAUTH-SETUP.md) ve [.env.example](.env.example).

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

**Otomatik:** Backend startup'ta `dbContext.Database.Migrate()` çalıştırır (`Program.cs`).
`sudo systemctl restart fikir-api` yeterlidir; manuel migration adımı **gerekmez**.

Elle kontrol etmek veya rollback için:

```bash
cd /opt/fikir-platformu/backend
dotnet ef database update --project src/FikirPlatformu.Infrastructure --startup-project src/FikirPlatformu.Api

# Beklenen migration sırası: InitialMySql → AddAuthEvents → AddDataProtectionKeys → AddTwoFactorMethod
```

> ⚠️ `dotnet ef migrations add` Windows kernel sandbox'ta dosya yazamıyor.
> Yeni migration CI'da veya temiz bash ortamında üretilmeli.

### 8) İlk admin kullanıcı

**Elle SQL yazmayın.** `PasswordHash` ASP.NET Identity v3 PBKDF2 biçimindedir;
elle üretilen hash çalışmaz ve hesap kilitlenir.

İlk sistem yöneticisi iki yoldan biriyle oluşur:

**Yol A — `.env` ile (önerilen).** `SeedSystemAdmin__Email` ve `SeedSystemAdmin__Password`
tanımlıysa uygulama ilk açılışta (veritabanı boşsa) hesabı kendisi oluşturur.
Ayrıca `SystemAdmin` ve `MinistryOfficial` rollerini atar.

**Yol B — komutla.**

```bash
cd backend
SeedSystemAdmin__Password='<güçlü şifre>' \
  dotnet run --project src/FikirPlatformu.Api -- seed
```

Bu komut yalnızca sistem yöneticisini oluşturur. Diğer hesapları
(il yöneticisi, değerlendirici, bakanlık yetkilisi, öğrenci) uygulama
içinden açın: **Admin Panel → Kullanıcı Yönetimi**.

> ⚠️ Her iki yol da veritabanı boş değilse hiçbir şey yapmaz — mevcut
> hesaplara dokunmaz.
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
| Statik CDN'e taşınabilir | Cookie `SameSite=None; Secure` zorunlu | |
| | Çift SSL sertifikası |

---

## 🔑 İlk giriş ve MFA kurulumu

### İlk sistem yöneticisi hesabı

İlk kurulumda **tek** bir sistem yöneticisi hesabı oluşur. Şifresi sizin belirlediğiniz
`SeedSystemAdmin__Password` değeridir ve **bu dokümanda yazmaz** (güvenlik).

Oluşma koşulu: veritabanı boşsa. Hesap zaten varsa hiçbir şey yapılmaz.

Elle oluşturmak için:
```bash
cd backend
SeedSystemAdmin__Password='<güçlü şifre>' dotnet run --project src/FikirPlatformu.Api -- seed
```

Kurulum tamamlandıktan sonra `.env` içindeki `SeedSystemAdmin__Password` ve
`SeedSystemAdmin__Email` değerlerini silin.

### İlk giriş akışı (Sistem Yöneticisi)

1. **Siteye git:** `https://fikir.meb.gov.tr`
2. **Anasayfada** "Yetkili Girişi" butonuna tıkla
3. **E-posta:** `.env`'de verdiğiniz `SeedSystemAdmin__Email`
4. **Şifre:** `.env`'de verdiğiniz `SeedSystemAdmin__Password`
5. **CAPTCHA** sorusunu çöz
6. **MFA kurulum sayfası** açılır:
   - Google Authenticator veya Microsoft Authenticator uygulamasını aç
   - "Manuel olarak ekle" seçeneğini kullan
   - Hesap adı: `system.admin@fikir.local` (veya sayfada gösterilen)
   - Gizli anahtar: sayfada gösterilen base32 secret'i gir
   - Tip: TOTP, 6 hane, 30 saniye
7. **Authenticator'dan** 6 haneli kodu gir → "Kurulumu tamamla"
8. **Bakanlık paneline** yönlendirilirsin
9. **Üst menüden** "Kullanıcı Yönetimi" → `/bakanlik/admin/kullanicilar`
10. **Yeni kullanıcı oluştur:** Bakanlık/İl/Evaluator hesapları ekle

### Şifre değiştirme

İlk girişten sonra her kullanıcı kendi şifresini değiştirmeli (`/api/auth/change-password`). Sistem yöneticisi bu zorunluluğu `MustChangePassword=true` ile zorlar.

### Diğer hesapları oluşturma

İl yöneticisi, değerlendirici, bakanlık yetkilisi ve öğrenci hesapları **uygulama içinden**
açılır: **Admin Panel → Kullanıcı Yönetimi**. Toplu import için **Kullanıcı Yönetimi →
Toplu Ekleme** (CSV).

Test/demo hesapları kodu içinde **yoktur** — yalnızca `Development` ortamında
`Program.cs` demo seed'i çalışır; production'da çalışmaz.

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

## 🔐 MFA Email OTP kurulumu (Sprint 10)

Yetkili kullanıcılar için **iki** MFA yöntemi açıktır:
1. **TOTP** — Google/MS Authenticator uygulaması (Sprint 7'den beri)
2. **Email OTP** — kullanıcının e-posta adresine 6 haneli kod gönderilir (Sprint 10)

### E-posta sağlayıcısı seçimi

`Mail__Type` env ile backend seçim yapar:

- **`Mail__Type=gmail`** (önerilen) — Gmail API OAuth2 HTTPS — port 443, Render/SaaS uyumlu
- **`Mail__Type=resend`** — Resend HTTPS API, kolay setup, 100 mail/gün ücretsiz
- **`Mail__Type=` (boş)** — Development mode (log'a yazar)

### Gmail OAuth2 kurulumu

`docs/GOOGLE-OAUTH-SETUP.md` tam adımları içerir. Özet:

1. https://console.cloud.google.com → proje → Gmail API enable
2. OAuth consent screen (External) → name "Geleceğin Fikri"
3. Credentials → OAuth client → Web application → Authorized redirect URIs:
   - Production: `https://fikir.meb.gov.tr/api/auth/gmail-oauth/callback`
   - Test: `https://fikir-platformu.onrender.com/api/auth/gmail-oauth/callback`
4. Client ID + Secret → env'ye yaz
5. Browser'da `/api/auth/gmail-oauth/start` → Allow → JSON'daki `refresh_token` → env'ye yaz

> **redirect_uri** Google'da tanımlı olanla **birebir aynı** olmalı (sondaki `/` dahil).

### Frontend otomatik Email flow

1. Yetkili e-posta/şifre ile giriş → backend `mfaRequired:true` → frontend `/mfa-login`
2. Kullanıcı "E-posta kodu" seçeneğini seçer
3. Frontend **doğrudan** `/api/mfa/send-email-otp` çağırır. Kod ekranı açılır ve
   gönderim sürerken buton "Kod gönderiliyor…" durumuna geçer.
   (Sprint 11.65: ekranda OAuth'a otomatik yönlendirme **kaldırıldı** — 11.51'de
   per-user OAuth yerine sistem sabit göndericiye geçildi, bu artık geçerli bir yol değil.)
4. `send-email-otp` 401 dönerse `needsGmailOAuth:true` gelir ve o zaman **Elle**
   OAuth başlatılır: `/api/auth/gmail-oauth/start` (token `Mail__Gmail__RefreshToken`
   env'inde ya da DB'de tanımlıysa bu adım hiç gerekmez)
5. Kod e-postaya gelir → scheme upgrade → panele yönlendirilir

### Cross-context guard

Bir context'te (student/province/ministry) oturum açıksa diğer context'in modalinde login formu **gizlidir**. Sadece banner + "Çıkış yap" gösterilir.

### Frontend cache headers

- Render için: `infra/render.yaml` Blueprint — index.html no-cache, assets 1y immutable
- nginx için: Bölüm 5'te `location /assets/` bloğunda `expires 1y; immutable` zaten var

---

## 📞 Destek

Geliştirici ekibi: **Onur** (Windows kernel driver developer — O-Freeze projesi)
Son güncelleme: Sprint 11.50 — dokümantasyon düzeltmeleri (HEAD `64bbb7a`)
GitHub: https://github.com/OCorptr/fikir-platformu

> Operasyon sorunları için `docs/runbook.md`, mimari için `docs/architecture.md`,
> aktif sprint durumu için `HANDOVER.md`.