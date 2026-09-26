// MFA kurulum sayfası (Sprint 10 — method choice: TOTP veya Email).
// Login sonrası backend mfaSetupRequired:true döndürdüğünde yönlendirilir.
// Adımlar:
//   1) Kullanıcı method seçer (TOTP veya Email)
//   2) /api/auth/mfa/setup → method'a göre secret+otpauth veya email kodu gönderir
//   3) Kullanıcı TOTP code girer VEYA email kodunu doğrular (ekranda gösterilir)
//   4) /api/auth/mfa/verify-setup → code doğrula + scheme upgrade
//   5) İlgili panele yönlendir (ministry/il-panel/fikir)
//
// Koruma: giriş yapmamış kullanıcı bu sayfayı açamaz (Onur feedback).
// API 401/403 dönerse /giris'e yönlendirilir.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { mfaSetupBaslat, mfaVerifyKod, mfaGetMethod, mfaCancel, type MfaMethod } from "../services/auth";
import type { MfaSetupResponse } from "../services/auth";

type Adim = "secim" | "kurulum" | "dogrulama" | "tamamlandi";

function authHatasiMi(hata: unknown): boolean {
  return hata instanceof ApiHttpError && (hata.status === 401 || hata.status === 403);
}

export function MfaSetupPage() {
  const navigate = useNavigate();
  const [adim, setAdim] = useState<Adim>("secim");
  const [yontem, setYontem] = useState<MfaMethod | null>(null);
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  // Sayfa mount: /me ile doğrula — giriş yapılmamışsa /giris'e at.
  useEffect(() => {
    const controller = new AbortController();
    // Hafif bir probe: /api/auth/mfa/method PreMfaOnly gerektiriyor;
    // 401/403 dönerse authenticated değil demektir.
    mfaGetMethod()
      .then(() => { /* PreMfa scheme geçerli — sayfada kal */ })
      .catch((e) => {
        if (authHatasiMi(e)) {
          navigate("/giris", { replace: true });
        }
      });
    return () => controller.abort();
  }, [navigate]);

  async function methodSecimVeBaslat(method: MfaMethod) {
    setYontem(method);
    setCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await mfaSetupBaslat(method);
      setSetup(sonuc);
      setAdim("kurulum");
    } catch (e) {
      if (authHatasiMi(e)) {
        navigate("/giris", { replace: true });
        return;
      }
      setHata(e instanceof ApiHttpError ? e.message : "Kurulum başlatılamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  // 'Çıkış - Ana Sayfa' — MFA akışını iptal et, PreMfa cookie temizle, ana sayfaya dön.
  async function handleCikis() {
    setCalisiyor(true);
    try {
      await mfaCancel();
    } catch {
      // Best-effort — başarısız olsa bile ana sayfaya git (cookie kendi expire olur).
    } finally {
      navigate("/", { replace: true });
      setCalisiyor(false);
    }
  }

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
      if (authHatasiMi(e)) {
        navigate("/giris", { replace: true });
        return;
      }
      setHata(e instanceof ApiHttpError ? e.message : "Kod doğrulanamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  // ----- ADIM 1: Method seçimi -----
  if (adim === "secim") {
    return (
      <main className="sayfa-ortak mfa-kurulum">
        <h1>İki adımlı doğrulama kurulumu</h1>
        <p className="mfa-aciklama">
          Hesabınız için iki adımlı doğrulama zorunlu. Aşağıdaki yöntemlerden birini seçin:
        </p>

        <div className="mfa-yontem-secim">
          <button
            type="button"
            className="mfa-yontem-kart"
            onClick={() => methodSecimVeBaslat("Totp")}
            disabled={calisiyor}
          >
            <div className="mfa-yontem-ikon">📱</div>
            <h3>Authenticator Uygulaması</h3>
            <p>Google Authenticator, Microsoft Authenticator veya TOTP destekli herhangi bir uygulama.</p>
            <small>✅ Daha güvenli (offline çalışır)</small>
          </button>

          <button
            type="button"
            className="mfa-yontem-kart"
            onClick={() => methodSecimVeBaslat("Email")}
            disabled={calisiyor}
          >
            <div className="mfa-yontem-ikon">📧</div>
            <h3>E-posta OTP</h3>
            <p>Her girişte e-posta adresinize 6 haneli kod gönderilir.</p>
            <small>✅ Uygulama gerekmez, e-postaya erişim yeterli</small>
          </button>
        </div>

        {hata && (
          <div className="durum-banner durum-banner--hata" role="alert">
            <span>{hata}</span>
          </div>
        )}

        <div className="mfa-setup-cikis" style={{ marginTop: "1.5rem" }}>
          <button type="button" className="btn-link" onClick={handleCikis}>
            Çıkış - Ana Sayfa
          </button>
        </div>
      </main>
    );
  }

  // ----- ADIM 2: Kurulum bilgileri (TOTP veya Email) -----
  if (adim === "kurulum" && !setup) {
    return (
      <main className="sayfa-ortak">
        <p>Kurulum bilgileri yükleniyor…</p>
      </main>
    );
  }

  if (adim === "kurulum" && yontem === "Totp" && setup?.method === "Totp") {
    // TOTP: secret + otpauth göster
    return (
      <main className="sayfa-ortak mfa-kurulum">
        <h1>1️⃣ Authenticator uygulamasını kur</h1>
        <ol className="mfa-adimlar">
          <li>
            <strong>1. Authenticator uygulamasını açın</strong>
            <p>Google Authenticator, Microsoft Authenticator veya TOTP destekli herhangi bir uygulama.</p>
          </li>
          <li>
            <strong>2. Yeni hesap ekleyin</strong>
            <p>"Manuel olarak ekle" seçeneğini kullanın:</p>
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
            <p>Authenticator'da görünen 6 haneli kodu aşağıya yazın.</p>
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
          <button type="button" className="btn-link" onClick={() => { setAdim("secim"); setSetup(null); setHata(null); }}>
            ← Yöntemi değiştir
          </button>
        </form>
      </main>
    );
  }

  if (adim === "kurulum" && yontem === "Email" && setup?.method === "Email") {
    // Email OTP: e-postaya kod gönderildi, kullanıcı kodu okuyup girecek
    return (
      <main className="sayfa-ortak mfa-kurulum">
        <h1>📧 E-postanıza kod gönderildi</h1>
        <p className="mfa-aciklama">
          <code>{setup.emailHint}***@…</code> adresine 6 haneli bir doğrulama kodu gönderdik.
          E-postayı açıp kodu aşağıya girin.
        </p>
        <p className="mfa-aciklama" style={{ fontSize: "0.85rem", color: "#888" }}>
          ⏱️ Kod 5 dakika geçerlidir. E-posta gelmedi mi? Spam klasörünü kontrol edin.
        </p>

        <form className="mfa-form" onSubmit={handleOnayla}>
          <label className="mfa-alan">
            <span>6 haneli e-posta kodu</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              autoFocus
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
          <button type="button" className="btn-link" onClick={() => { setAdim("secim"); setSetup(null); setHata(null); }}>
            ← Yöntemi değiştir
          </button>
        </form>
      </main>
    );
  }

  // ----- ADIM 3: Tamamlandı (handleOnayla navigate eder, buraya düşmez) -----
  return (
    <main className="sayfa-ortak">
      <p>Kurulum tamamlandı, yönlendiriliyor…</p>
    </main>
  );
}
