// MFA login sayfası (Sprint 10 — method-aware + method-choice UI).
// İki adım:
//   1) SEÇİM: kullanıcı yöntem seçer (Authenticator / E-posta).
//   2) GİRİŞ: seçilen yöntem için 6 haneli kod input.
// Kayıtlı yöntem "önerilen" rozetiyle işaretlenir (useEffect).
//
// Koruma: giriş yapmamış kullanıcı bu sayfayı açamaz.
// Kullanıcı /me veya /api/auth/mfa/method 401/403 alırsa /giris'e
// yönlendirilir (Yetkili Girişi modalı orada açılır).

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { mfaCancel, mfaGetMethod, mfaLoginVerify, mfaSendEmailOtp } from "../services/auth";

type Method = "Totp" | "Email" | "Bilinmiyor";
type Ekran = "secim" | "giris";

// 401/403 = authenticated değil veya MFA cookie'si yok → /giris'e at.
// Onur feedback: giriş yapmamış kullanıcı bu sayfayı açamamalı.
function authHatasiMi(hata: unknown): boolean {
  return hata instanceof ApiHttpError && (hata.status === 401 || hata.status === 403);
}

export function MfaLoginPage() {
  const navigate = useNavigate();
  const [ekran, setEkran] = useState<Ekran>("secim");
  const [kayitliYontem, setKayitliYontem] = useState<Method | null>(null);
  const [seciliYontem, setSeciliYontem] = useState<Method | null>(null);
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [emailGonderildi, setEmailGonderildi] = useState(false);
  const [gonderimHatasi, setGonderimHatasi] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0); // saniye

  // Sayfa açıldığında: PreMfa cookie'si var mı? Backend'e method sor.
  // 401/403 → kullanıcı authenticated değil veya MFA cookie süresi dolmuş
  // → /giris'e yönlendir.
  useEffect(() => {
    const controller = new AbortController();
    mfaGetMethod()
      .then((m) => {
        const yontem: Method = m.method === "Email" ? "Email" : "Totp";
        setKayitliYontem(yontem);
      })
      .catch((e) => {
        if (authHatasiMi(e)) {
          // Giriş yapılmamış veya MFA cookie süresi dolmuş → login'e at.
          navigate("/giris", { replace: true });
          return;
        }
        // Ağ hatası vb. → seçim ekranı yine de açılsın (rozet olmadan).
        setKayitliYontem(null);
      });
    return () => controller.abort();
  }, [navigate]);

  // Cooldown geri sayım
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function yontemSec(yontem: Method) {
    setSeciliYontem(yontem);
    setKod("");
    setHata(null);
    setGonderimHatasi(null);
    setEmailGonderildi(false);
    setEkran("giris");
    // Email seçildiyse otomatik OTP gönder.
    if (yontem === "Email") {
      void emailOtpGonder(true);
    }
  }

  function geriDonSecim() {
    setEkran("secim");
    setSeciliYontem(null);
    setKod("");
    setHata(null);
    setGonderimHatasi(null);
    setEmailGonderildi(false);
    setCooldown(0);
  }

  // 'Çıkış - Ana Sayfa' — MFA akışını iptal et, PreMfa cookie'yi temizle, ana sayfaya dön.
  async function handleCikis() {
    setCalisiyor(true);
    try {
      // Backend best-effort çağrı: başarısız olsa bile ana sayfaya git (cookie kendi expire olur).
      await mfaCancel();
    } catch {
      // Sessizce yut — kullanıcı zaten çıkmak istiyor, hata gösterme.
    } finally {
      navigate("/", { replace: true });
      setCalisiyor(false);
    }
  }

  async function emailOtpGonder(ilkGonderim: boolean): Promise<boolean> {
    setCalisiyor(true);
    setGonderimHatasi(null);
    try {
      const cevap = await mfaSendEmailOtp();
      setEmailGonderildi(true);
      // Development modunda backend kodu response'a koyar; ekranda göster.
      // SMTP'li üretimde devCode=null gelir, hiç gösterilmez.
      if (cevap.devCode) {
        setKod(cevap.devCode);
      }
      if (!ilkGonderim) setCooldown(60);
      return true;
    } catch (e) {
      if (authHatasiMi(e)) {
        navigate("/giris", { replace: true });
        return false;
      }
      setGonderimHatasi(
        e instanceof ApiHttpError ? e.message : "Kod gönderilemedi, tekrar deneyin."
      );
      return false;
    } finally {
      setCalisiyor(false);
    }
  }

  async function handleTekrarGonder() {
    if (cooldown > 0) return;
    await emailOtpGonder(false);
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
      if (authHatasiMi(e)) {
        navigate("/giris", { replace: true });
        return;
      }
      setHata(e instanceof ApiHttpError ? e.message : "Kod doğrulanamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  // === SEÇİM EKRANI ===
  if (ekran === "secim") {
    return (
      <main className="sayfa-ortak mfa-login mfa-secim">
        <h1>🔐 İki adımlı doğrulama</h1>
        <p className="mfa-aciklama">
          Girişinizi tamamlamak için bir doğrulama yöntemi seçin.
        </p>

        <div className="mfa-yontem-secim">
          <button
            type="button"
            className={`mfa-yontem-kart${kayitliYontem === "Totp" ? " onerilen" : ""}`}
            onClick={() => yontemSec("Totp")}
          >
            <span className="mfa-yontem-ikon">📱</span>
            <span className="mfa-yontem-baslik">Authenticator Uygulaması</span>
            <span className="mfa-yontem-aciklama">
              Telefonunuzdaki Google Authenticator / Microsoft Authenticator
              uygulamasında görünen 6 haneli kodu girin.
            </span>
            {kayitliYontem === "Totp" && (
              <span className="mfa-yontem-rozet">Önerilen</span>
            )}
          </button>

          <button
            type="button"
            className={`mfa-yontem-kart${kayitliYontem === "Email" ? " onerilen" : ""}`}
            onClick={() => yontemSec("Email")}
          >
            <span className="mfa-yontem-ikon">📧</span>
            <span className="mfa-yontem-baslik">E-posta kodu</span>
            <span className="mfa-yontem-aciklama">
              E-posta adresinize 6 haneli bir kod gönderelim (5 dakika geçerli).
            </span>
            {kayitliYontem === "Email" && (
              <span className="mfa-yontem-rozet">Önerilen</span>
            )}
          </button>
        </div>

        <button type="button" className="btn-link" onClick={handleCikis} disabled={calisiyor}>
          {calisiyor ? "Çıkış yapılıyor…" : "Çıkış - Ana Sayfa"}
        </button>
      </main>
    );
  }

  // === GİRİŞ EKRANI ===
  const emailModu = seciliYontem === "Email";
  const baslik = emailModu ? "📧 E-posta doğrulama" : "📱 Authenticator kodu";
  const aciklama = emailModu
    ? emailGonderildi
      ? "E-posta adresinize 6 haneli kod gönderdik. Kodu aşağıya girin."
      : "E-posta kodu hazırlanıyor…"
    : "Authenticator uygulamanızda görünen 6 haneli kodu girin.";

  return (
    <main className="sayfa-ortak mfa-login mfa-giris">
      <h1>{baslik}</h1>
      <p className="mfa-aciklama">{aciklama}</p>

      {/* Development modunda backend OTP kodunu response'a koyar — input otomatik dolar;
          üretim SMTP aktifse bu banner hiç gösterilmez (devCode null gelir). */}
      {emailModu && emailGonderildi && kod.length === 6 && (
        <div className="mfa-dev-banner" role="status">
          🛠️ Demo ortamı: SMTP yapılandırılmamış, kod otomatik input'a yazıldı.
          Doğrudan <b>Giriş yap</b>'a tıklayabilirsiniz.
        </div>
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

      <div className="mfa-yontem-yardimci">
        {emailModu && (
          <button
            type="button"
            className="btn-link"
            onClick={handleTekrarGonder}
            disabled={cooldown > 0 || calisiyor}
          >
            {cooldown > 0
              ? `Kodu tekrar gönder (${cooldown}sn)`
              : "Kodu tekrar gönder"}
          </button>
        )}
        {gonderimHatasi && (
          <div
            className="durum-banner durum-banner--hata"
            role="alert"
            style={{ marginTop: "0.6rem" }}
          >
            <span>{gonderimHatasi}</span>
          </div>
        )}
        <button type="button" className="btn-link" onClick={geriDonSecim}>
          ← Yöntem seçimine dön
        </button>
      </div>
    </main>
  );
}
