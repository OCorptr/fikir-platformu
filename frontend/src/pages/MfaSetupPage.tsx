// MFA kurulum sayfası (Sprint 9).
// Login sonrası backend mfaSetupRequired:true döndürdüğünde yönlendirilir.
// Adımlar:
//   1) /api/auth/mfa/setup → secret + otpauthUrl al
//   2) Kullanıcı Google/Microsoft Authenticator'a otpauthUrl'i ekler (manuel entry)
//   3) 6 haneli kodu girer
//   4) /api/auth/mfa/verify-setup → code doğrula + scheme upgrade
//   5) İlgili panele yönlendir (ministry/il-panel/fikir)

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { mfaSetupBaslat, mfaVerifyKod } from "../services/auth";
import type { MfaSetupResponse } from "../services/auth";

export function MfaSetupPage() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kopyalandi, setKopyalandi] = useState(false);

  useEffect(() => {
    setYukleniyor(true);
    mfaSetupBaslat()
      .then((s) => setSetup(s))
      .catch((e) => setHata(e instanceof ApiHttpError ? e.message : "Kurulum başlatılamadı."))
      .finally(() => setYukleniyor(false));
  }, []);

  async function handleOnayla(olay: FormEvent) {
    olay.preventDefault();
    if (!/^\d{6}$/.test(kod)) {
      setHata("6 haneli sayısal kod girin.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await mfaVerifyKod(kod);
      // Scheme upgrade tamamlandı → ilgili panele yönlendir.
      const ctx = sonuc.context ?? "student";
      if (ctx === "ministry") navigate("/bakanlik");
      else if (ctx === "province") navigate("/il-panel");
      else navigate("/fikir");
    } catch (e) {
      setHata(e instanceof ApiHttpError ? e.message : "Kod doğrulanamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  function handleKopyala() {
    if (!setup) return;
    navigator.clipboard.writeText(setup.otpauthUrl)
      .then(() => {
        setKopyalandi(true);
        setTimeout(() => setKopyalandi(false), 2000);
      })
      .catch(() => setHata("Kopyalanamadı — lütfen manuel olarak seçin."));
  }

  if (yukleniyor) {
    return (
      <main className="sayfa-ortak">
        <div className="durum-banner durum-banner--bilgi">
          <span>MFA kurulum bilgileri yükleniyor…</span>
        </div>
      </main>
    );
  }

  if (!setup) {
    return (
      <main className="sayfa-ortak">
        <div className="durum-banner durum-banner--hata">
          <span>{hata ?? "Kurulum başlatılamadı. Lütfen tekrar giriş yapın."}</span>
        </div>
        <button className="btn-ana" onClick={() => navigate("/")}>Ana sayfa</button>
      </main>
    );
  }

  return (
    <main className="sayfa-ortak mfa-kurulum">
      <h1>İki adımlı doğrulama kurulumu</h1>
      <p className="mfa-aciklama">
        Hesabınız için iki adımlı doğrulama (TOTP, RFC 6238) zorunlu. Google Authenticator
        veya Microsoft Authenticator uygulamasına aşağıdaki bilgileri ekleyin, ardından
        uygulamada görünen 6 haneli kodu girin.
      </p>

      <ol className="mfa-adimlar">
        <li>
          <strong>1. Authenticator uygulamasını açın</strong>
          <p>Google Authenticator veya Microsoft Authenticator (veya TOTP destekli herhangi bir uygulama).</p>
        </li>
        <li>
          <strong>2. Yeni hesap ekleyin</strong>
          <p>"Manuel olarak ekle" veya "Manuel giriş" seçeneğini kullanın. QR tarayıcı yoksa
            aşağıdaki bilgileri girin:</p>
          <dl className="mfa-bilgi">
            <dt>Hesap adı</dt>
            <dd><code>{setup.issuer}</code></dd>
            <dt>İşletme</dt>
            <dd><code>{setup.issuer}</code></dd>
            <dt>Gizli anahtar (secret)</dt>
            <dd className="mfa-secret">
              <code>{setup.secret}</code>
              <button type="button" className="btn-kucuk" onClick={() => {
                navigator.clipboard.writeText(setup.secret).catch(() => {});
              }}>Kopyala</button>
            </dd>
            <dt>Algoritma</dt>
            <dd>TOTP, {setup.digits} hane, {setup.period} saniye</dd>
          </dl>
        </li>
        <li>
          <strong>3. Kodu girin</strong>
          <p>Authenticator uygulamasında görünen 6 haneli kodu aşağıya yazın.</p>
        </li>
      </ol>

      <form className="mfa-form" onSubmit={handleOnayla}>
        <label className="mfa-alan">
          <span>6 haneli doğrulama kodu</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
            value={kod}
            onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
          />
        </label>
        {hata && (
          <div className="durum-banner durum-banner--hata" role="alert">
            <span>{hata}</span>
          </div>
        )}
        <button type="submit" className="btn-ana" disabled={calisiyor}>
          {calisiyor ? "Doğrulanıyor…" : "Kurulumu tamamla"}
        </button>
      </form>

      <details className="mfa-detay">
        <summary>Bağlantıyı kopyalamak ister misiniz?</summary>
        <p>Bazı uygulamalar otpauth:// bağlantısını kabul eder. Kopyalayıp uygulamaya yapıştırabilirsiniz:</p>
        <code className="mfa-otpauth">{setup.otpauthUrl}</code>
        <button type="button" className="btn-kucuk" onClick={handleKopyala}>
          {kopyalandi ? "✓ Kopyalandı" : "Bağlantıyı kopyala"}
        </button>
      </details>
    </main>
  );
}
