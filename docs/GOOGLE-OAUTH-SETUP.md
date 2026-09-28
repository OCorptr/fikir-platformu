# Gmail API OAuth2 Kurulumu (Onur)

> **Neden bu var?** Render free tier bugün itibarıyla **SMTP port 25/465/587'yi tamamen blokladı** (https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports). Gmail SMTP'yi bypass etmenin tek yolu **HTTPS API** kullanmak → OAuth2.

---

## 4 adım (toplam ~10dk)

### 1) Google Cloud Console — Proje + Gmail API

1. Tarayıcıda → https://console.cloud.google.com/
2. Üstte proje seçici → **"New Project"** → isim: `fikir-platformu-mfa` → Create
3. Sol menü → **APIs & Services** → **Library** → "Gmail API" ara → **Enable**

### 2) OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. User type: **External** → Create
3. App information:
   - App name: `Geleceğin Fikri`
   - User support email: kendi Gmail adresi
   - Developer contact: kendi Gmail adresi
4. **Save and Continue** (Scopes'i sonra ekleyeceğiz)
5. **Save and Continue** (Test users'da kendi Gmail'ini ekle)
6. **Back to Dashboard**

### 3) OAuth Client ID oluştur

1. **APIs & Services** → **Credentials** → **"+ Create Credentials"** → **OAuth client ID**
2. Application type: **Web application**
3. Name: `fikir-platformu-render`
4. **Authorized redirect URIs** → **"+ Add URI"**:
   ```
   https://fikir-platformu.onrender.com/api/auth/gmail-oauth/callback
   ```
5. **Create** → JSON indir veya ekrandaki **Client ID** + **Client Secret**'i kopyala (kısa süre sonra tekrar görebilirsin ama hemen kaydet)

### 4) Refresh token al (tek seferlik)

> ⚠️ **Sprint 11.36+ bu adım env'e yazılmıyor.** Callback artık refresh token'ı
> PBKDF2 ile şifreleyip `gmail_refresh_tokens` tablosuna (Id=1) kaydediyor.
> Aşağıdaki adım yalnızca token expire olduysa veya debug için ham JSON'u
> görmek istiyorsan gerekli.

Browser'da bu URL'ye git:

```
https://fikir-platformu.onrender.com/api/auth/gmail-oauth/start
```

**Adımlar:**
1. Google seni login'e yönlendirir → oturum aç
2. "Geleceğin Fikri wants to access your Google Account" → **"Allow"** / **"İzin ver"**
3. Tarayıcı `/api/auth/gmail-oauth/callback` adresine geri döner
4. JSON response'da **`refresh_token`** alanını kopyala
   ```json
   {
     "message": "OAuth2 basarili — su degerleri Render env var olarak ekle:",
     "refresh_token": "1//0eXxxxxxxxxxxxxxxxxxxxxxxxx",
     "access_token_expires_in": 3599,
     "scope": "https://www.googleapis.com/auth/gmail.send"
   }
   ```

### 5) Render Environment Variables

`fikir-platformu` service → **Environment** → şu değişkenleri ekle:

| Key | Value |
|---|---|
| `Mail__Type` | `gmail` |
| `Mail__Gmail__ClientId` | `xxx.apps.googleusercontent.com` (Adım 3'teki) |
| `Mail__Gmail__ClientSecret` | `GOCSPX-xxx` (Adım 3'teki) |
| `Mail__Gmail__RedirectUri` | `https://fikir-platformu.onrender.com/api/auth/gmail-oauth/callback` |
| `Mail__Gmail__SenderAddress` | `fikir.platformu.iletisim@gmail.com` |
| `Mail__Gmail__SenderName` | `Geleceğin Fikri` |
| ~~`Mail__Gmail__RefreshToken`~~ | **Artık gerekmiyor** — DB'de (`gmail_refresh_tokens`) saklanıyor |

**Save** → Render otomatik redeploy yapar (~3dk).

**Doğrulama:**

```bash
curl "https://fikir-platformu.onrender.com/api/auth/__debug/mail-sender?token=$Bakim_Anahtari"
# dbRefreshTokenVar: true olmalı (false ise OAuth handshake tekrarla)
```

---

## Test

1. Tarayıcıda → `https://fikir-platformu-web.onrender.com/`
2. Ana sayfada **Yetkili Girişi** → email/şifre/CAPTCHA
3. MFA ekranı → 📧 **E-posta kodu** kartı
4. Kod `onur35bilisim@gmail.com` adresine **gerçekten gelir** (Spam klasörünü de kontrol et)

Backend log'unda göreceğin:
```
[INFO] [GMAIL] Gönderildi: alici@mail.com | Geleceğin Fikri — Giriş Doğrulama Kodu
```

---

## Sorun Giderme

| Hata | Çözüm |
|---|---|
| `Mail__Gmail__RefreshToken reddedildi` | Refresh token revoke edilmiş. Adım 4'ü tekrarla (`prompt=consent` zaten bizde). |
| Mail gelmiyor, log yok | Mail__Type=gmail ayarlanmamış. `MAIL__TYPE=gmail` (büyük harfle) doğru mu? |
| 401 invalid_client | ClientId veya ClientSecret yanlış. Google Cloud Console'dan tekrar kopyala. |
| "redirect_uri_mismatch" | Mail__Gmail__RedirectUri Google'da tanımlı olanla birebir aynı olmalı (sonda `/` fark etmez). |
| CORS/Cookie hatası | Google OAuth callback `.FikirOAuthState` cookie yazıyor — `SameSite=Lax` + `Secure` (HTTPS) gerekli. Render HTTPS zaten aktif. |

---

## Not

- **Refresh token** DB'de şifreli saklanır (`gmail_refresh_tokens`, PBKDF2). Env'de tutulmaz.
- OAuth callback `/api/auth/gmail-oauth/callback` → DB upsert → `returnTo`'ya redirect.
  Elle env'e yazma adımı **Sprint 11.36 ile kaldırıldı**.
- **Token expire olursa:** `/admin/oauth` sayfasından handshake'i tekrarla (Sprint 11.36).
  Google Test Mode refresh token 7 gün; Production domain doğrulaması sonrası 6 ay.
- Birden fazla alıcıya gönderimde bile Gmail API tek seferde en fazla 100 alıcı destekler; YEĞİTEK için yeterli.
- App Password **gerekmez** — OAuth2 refresh token ile çalışır.
- Bu endpoint'ler (`/gmail-oauth/start`, `/gmail-oauth/callback`) **kimlik doğrulama gerektirmez** — state cookie CSRF koruması sağlıyor; production'da public kapatılabilir.
