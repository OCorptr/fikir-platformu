// OAuth handshake tetikleme sayfası — Sistem Yöneticisi için.
//
// Onur Sprint 11.x: OAuth handshake için incognito pencere + Gmail login +
// URL yapıştırma adımları karmaşık. Admin Panel'den tek tıkla
// /api/auth/gmail-oauth/start URL'i açılır, Google consent screen gelir,
// Onur `fikir.platformu.iletisim@gmail.com` hesabını seçer, callback DB'ye
// persist olur. Sonraki tüm mailler bu hesaptan gider.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const OAUTH_START_URL = "https://fikir-platformu.onrender.com/api/auth/gmail-oauth/start";

export function OAuthAyarlaPage() {
  const [mevcut, setMevcut] = useState<{ hasToken: boolean } | null>(null);
  const [kontrolHatasi, setKontrolHatasi] = useState<string | null>(null);

  // Sayfa mount'ında OAuth handshake durumunu kontrol et (callback sonrası
  // ?gmail_oauth=ok query'si buraya gelebilir; query'yi kaldır ki reload
  // tekrar tetiklemesin).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("gmail_oauth") === "ok") {
      url.searchParams.delete("gmail_oauth");
      url.searchParams.delete("has_token");
      window.history.replaceState({}, "", url.toString());
      // Başarı durumunda mevcut token DB'de var demektir.
      setMevcut({ hasToken: true });
    } else {
      setMevcut({ hasToken: false });
    }
  }, []);

  function baslat() {
    // Sprint 11.36: Aynı sekmede OAuth handshake — Chrome/Firefox/Safari 3rd-party
    // cookie engeli yüzünden yeni sekme (window.open) ile backend `.FikirOAuthState`
    // cookie'si callback'te gelmiyordu → "state uyumsuz — CSRF koruması" hatası.
    // window.location.href ile aynı sekmede navigation → cookie 1st-party kabul
    // edilir, callback'te state doğrulanır. Backend callback zaten
    // /admin/oauth?gmail_oauth=ok ile frontend'e redirect eder.
    window.location.href = OAUTH_START_URL;
  }

  return (
    <section className="oauth-ayarla">
      <h2 className="oauth-baslik">Gmail OAuth Yapılandırması</h2>
      <p className="oauth-aciklama">
        Sistem Sabit Gmail modunda tüm mailler (şifre sıfırlama, MFA OTP,
        toplu davet) DB'deki tek bir Gmail hesabından gönderilir. Bu hesabı
        OAuth handshake ile bağlamak için aşağıdaki butona tıklayın:
      </p>

      {mevcut?.hasToken && (
        <div className="oauth-basarili" role="status">
          ✓ OAuth handshake başarıyla tamamlandı. Tüm mailler artık bağlı
          Gmail hesabından gönderilecek.
        </div>
      )}
      {kontrolHatasi && <div className="oauth-hata">{kontrolHatasi}</div>}

      <ol className="oauth-adimlar">
        <li>
          <strong>Yeni pencere açılacak.</strong> Google OAuth ekranı gelir.
        </li>
        <li>
          <strong>Hesap seç:</strong> Sistem için kullanmak istediğin Gmail
          hesabını seçin (örn. <code>fikir.platformu.iletisim@gmail.com</code>).
        </li>
        <li>
          <strong>İzin ver:</strong> "Gmail üzerinden e-posta gönder"
          iznini onaylayın.
        </li>
        <li>
          <strong>Callback otomatik:</strong> Sistem bu hesabın refresh
          token'ını şifreli olarak DB'ye kaydeder. Bu pencereye geri dönün.
        </li>
      </ol>

      <div className="oauth-aksiyonlar">
        <button type="button" className="btn btn-primary" onClick={baslat}>
          Gmail OAuth Handshake'i Başlat
        </button>
        <Link to="/admin/users" className="btn btn-ghost">
          ← Kullanıcı Yönetimine Dön
        </Link>
      </div>

      <details className="oauth-detay">
        <summary>Teknik detay</summary>
        <p>
          OAuth handshake: <code>/api/auth/gmail-oauth/start</code> →
          Google consent screen → <code>/api/auth/gmail-oauth/callback</code>
          {" "}→ DB <code>gmail_refresh_tokens</code> tablosu Id=1 satırı
          encrypted olarak güncellenir.
        </p>
        <p>
          OAuth token geçerlilik süresi Google tarafından yönetilir; refresh
          token ile sistem otomatik olarak yeni access token alır. Mevcut
          token iptal edilirse bu handshake tekrar yapılmalıdır.
        </p>
      </details>
    </section>
  );
}
