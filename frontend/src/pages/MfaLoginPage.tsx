// MFA login sayfası (Sprint 10 — method-aware).
// Login sonrası backend mfaRequired:true döndürdüğünde yönlendirilir.
// User'ın MFA method'u Email ise:
//   - Sayfa açıldığında otomatik kod gönderilir
//   - "Tekrar gönder" butonu ile yeni kod istenebilir (60sn cooldown)
// User'ın MFA method'u TOTP ise:
//   - Authenticator'dan kodu girer

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { mfaLoginVerify, mfaSendEmailOtp } from "../services/auth";

type Method = "Totp" | "Email" | "Yukleniyor" | "Bilinmiyor";

export function MfaLoginPage() {
  const navigate = useNavigate();
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [method, setMethod] = useState<Method>("Yukleniyor");
  const [emailGonderildi, setEmailGonderildi] = useState(false);
  const [gonderimHatasi, setGonderimHatasi] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0); // saniye

  // Sayfa açıldığında: kullanıcının MFA method'unu /me'den al.
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then(async (u) => {
        if (!u.authenticated) return;
        // sessions içinden herhangi birinde TwoFactorMethod var mı?
        // /me şu anda method döndürmüyor — bu yüzden tek yöntem: email OTP göndermeyi dene,
        // başarısız olursa TOTP ekranı göster. Daha temiz: backend /me'ye method eklemek.
        // Şimdilik basit yaklaşım: email OTP gönder, başarılıysa email yöntemi, değilse TOTP.
        const sent = await trySendEmailOtp();
        if (sent) {
          setMethod("Email");
          setEmailGonderildi(true);
        } else {
          setMethod("Totp");
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setHata(e instanceof ApiHttpError ? e.message : "Oturum bilgisi alınamadı.");
        setMethod("Bilinmiyor");
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown geri sayım
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function trySendEmailOtp(): Promise<boolean> {
    try {
      await mfaSendEmailOtp();
      return true;
    } catch {
      return false;
    }
  }

  async function handleTekrarGonder() {
    if (cooldown > 0) return;
    setCalisiyor(true);
    setGonderimHatasi(null);
    try {
      await mfaSendEmailOtp();
      setEmailGonderildi(true);
      setCooldown(60);
    } catch (e) {
      setGonderimHatasi(e instanceof ApiHttpError ? e.message : "Kod gönderilemedi.");
    } finally {
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
      const sonuc = await mfaLoginVerify(kod);
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

  // Yükleniyor durumu
  if (method === "Yukleniyor") {
    return (
      <main className="sayfa-ortak mfa-login">
        <p>MFA yöntemi algılanıyor…</p>
      </main>
    );
  }

  // Email OTP yöntemi
  if (method === "Email") {
    return (
      <main className="sayfa-ortak mfa-login">
        <h1>📧 E-posta doğrulama</h1>
        {emailGonderildi ? (
          <p className="mfa-aciklama">
            E-posta adresinize 6 haneli kod gönderdik. Kodu aşağıya girin.
          </p>
        ) : (
          <p className="mfa-aciklama">E-posta kodu hazırlanıyor…</p>
        )}

        <form className="mfa-form" onSubmit={handleOnayla}>
          <label className="mfa-alan">
            <span>Doğrulama kodu</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
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
            {calisiyor ? "Doğrulanıyor…" : "Giriş yap"}
          </button>
        </form>

        <button
          type="button"
          className="btn-link"
          onClick={handleTekrarGonder}
          disabled={cooldown > 0 || calisiyor}
        >
          {cooldown > 0 ? `Tekrar gönder (${cooldown}sn)` : "Kodu tekrar gönder"}
        </button>
        {gonderimHatasi && (
          <div className="durum-banner durum-banner--hata" role="alert" style={{ marginTop: "0.6rem" }}>
            <span>{gonderimHatasi}</span>
          </div>
        )}
      </main>
    );
  }

  // TOTP yöntemi (default)
  return (
    <main className="sayfa-ortak mfa-login">
      <h1>📱 İki adımlı doğrulama</h1>
      <p className="mfa-aciklama">
        Authenticator uygulamanızda görünen 6 haneli kodu girin.
      </p>

      <form className="mfa-form" onSubmit={handleOnayla}>
        <label className="mfa-alan">
          <span>Doğrulama kodu</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
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
          {calisiyor ? "Doğrulanıyor…" : "Giriş yap"}
        </button>
      </form>

      <button type="button" className="btn-link" onClick={() => navigate("/")}>
        Ana sayfaya dön
      </button>
    </main>
  );
}
