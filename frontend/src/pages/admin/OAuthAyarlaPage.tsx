// Gmail OAuth yapılandırma sayfası — Sistem Yöneticisi için.
//
// Sprint 11.64: Görsel dil İl AR-GE / Bakanlık panellerine yaklaştırıldı
// (admin-theme.css). İşlev değişmedi.
//
// Sprint 11.52: Adres kodda gömülüydü. Kendi sunucusunu kuran kurulumda
// yönetici, geliştiricinin Render sunucusuna yönlendirilirdi. Artık
// aynı-origin varsayılan; env ile farklı origin verilebilir.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { backendOrigin } from "../../services/api";

const OAUTH_START_URL = `${backendOrigin()}/api/auth/gmail-oauth/start`;

const ADIMLAR = [
  {
    baslik: "Google ekranı açılır",
    metin: "Tıklamanızın ardından Google izin ekranı gelir.",
  },
  {
    baslik: "Hesabı seçin",
    metin:
      "Sistem için kullanılacak Gmail hesabını seçin " +
      "(örn. fikir.platformu.iletisim@gmail.com).",
  },
  {
    baslik: "İzin verin",
    metin: "\"Gmail üzerinden e-posta gönder\" iznini onaylayın.",
  },
  {
    baslik: "Geri dönün",
    metin:
      "Sistem bu hesabın refresh token'ını şifreli olarak veritabanına kaydeder; " +
      "bu sayfaya otomatik dönersiniz.",
  },
];

export function OAuthAyarlaPage() {
  const [tokenVar, setTokenVar] = useState<boolean | null>(null);

  // Sayfa yüklenirken OAuth handshake durumunu kontrol et. Callback sonrası
  // `?gmail_oauth=ok` query'si buraya gelir; query'yi temizle ki sayfa
  // yenilenince tekrar tetiklenmesin.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("gmail_oauth") === "ok") {
      url.searchParams.delete("gmail_oauth");
      url.searchParams.delete("has_token");
      window.history.replaceState({}, "", url.toString());
      setTokenVar(true);
    } else {
      setTokenVar(false);
    }
  }, []);

  function baslat() {
    // Sprint 11.36: Aynı sekmede OAuth handshake. Chrome/Firefox/Safari'ın
    // üçüncü taraf çerez engeli yüzünden yeni sekme (window.open) ile backend
    // `.FikirOAuthState` çerezi callback'te gelmiyor ve "state uyuşmaz —
    // CSRF koruması" hatası veriyordu. window.location.href ile aynı sekmede
    // gezinme çerez birinci taraf kabul edilir, state doğrulanır. Backend
    // callback zaten /admin/oauth?gmail_oauth=ok ile buraya döner.
    window.location.href = OAUTH_START_URL;
  }

  return (
    <div className="adm-sayfa">
      <h2 className="adm-h2" style={{ marginTop: 0 }}>
        Gmail OAuth Yapılandırması
      </h2>
      <p className="adm-aciklama">
        Sistem sabit Gmail modunda tüm mailleri (şifre sıfırlama, MFA kodu, toplu
        davet) veritabanındaki tek bir Gmail hesabından gönderir. Bu hesabı
        OAuth handshake ile bağlamak için aşağıdaki düğmeyi kullanın.
      </p>

      {tokenVar === true && (
        <div className="adm-bildirim adm-bildirim-basari" role="status">
          <span aria-hidden="true">✓</span>
          <span>
            OAuth handshake tamamlandı. Tüm mailler artık bağlı Gmail
            hesabından gönderilecek.
          </span>
        </div>
      )}

      {tokenVar === false && (
        <div className="adm-bildirim adm-bildirim-bilgi" role="status">
          <span aria-hidden="true">ℹ</span>
          <span>
            Henüz bağlı bir Gmail hesabı yok. Aşağıdaki adımları tamamlayın.
          </span>
        </div>
      )}

      <section className="adm-kart" aria-labelledby="adm-adim-baslik">
        <h3 id="adm-adim-baslik" className="adm-h2" style={{ marginTop: 0 }}>
          Adımlar
        </h3>
        <ol className="adm-kucuk-metin" style={{ lineHeight: 1.9, paddingLeft: "1.2rem" }}>
          {ADIMLAR.map((a) => (
            <li key={a.baslik}>
              <strong style={{ color: "var(--yt-lacivert)" }}>{a.baslik}.</strong>{" "}
              {a.metin}
            </li>
          ))}
        </ol>

        <div className="adm-btn-kuyruk">
          <button type="button" className="adm-btn adm-btn-ana" onClick={baslat}>
            Gmail Bağlantısını Başlat
          </button>
          <Link to="/admin/users" className="adm-btn adm-btn-sessiz">
            ← Kullanıcı Yönetimi
          </Link>
        </div>
      </section>

      <details className="adm-kart">
        <summary className="adm-etiket" style={{ cursor: "pointer" }}>
          Teknik detay
        </summary>
        <div className="adm-kucuk-metin" style={{ marginTop: "0.6rem" }}>
          <p style={{ margin: "0 0 0.5rem" }}>
            OAuth handshake: <code>/api/auth/gmail-oauth/start</code> → Google
            izin ekranı → <code>/api/auth/gmail-oauth/callback</code> → veritabanı{" "}
            <code>gmail_refresh_tokens</code> tablosu şifrelenerek güncellenir.
          </p>
          <p style={{ margin: 0 }}>
            OAuth token geçerlilik süresini Google yönetir; sistem refresh token
            ile otomatik olarak yeni access token alır. Token iptal edilirse bu
            handshake yeniden yapılmalıdır.
          </p>
        </div>
      </details>
    </div>
  );
}
