// MFA login sayfası (Sprint 10 — method-aware + method-choice UI).
// İki adım:
//   1) SEÇİM: kullanıcı yöntem seçer (Authenticator / E-posta).
//   2) GİRİŞ: seçilen yöntem için 6 haneli kod input.
// Kayıtlı yöntem "önerilen" rozetiyle işaretlenir (useEffect).

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { mfaGetMethod, mfaLoginVerify, mfaSendEmailOtp } from "../services/auth";

type Method = "Totp" | "Email" | "Bilinmiyor";
type Ekran = "secim" | "giris";

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

  // Sayfa açıldığında: kullanıcının kayıtlı MFA method'unu /api/auth/mfa/method'dan al.
  // Hata olursa seçim ekranı yine de açılır (kullanıcı kendi seçebilir).
  useEffect(() => {
    const controller = new AbortController();
    mfaGetMethod()
      .then((m) => {
        const yontem: Method = m.method === "Email" ? "Email" : "Totp";
        setKayitliYontem(yontem);
      })
      .catch(() => {
        // Sessizce geç — seçim ekranı rozet olmadan görünür.
        setKayitliYontem(null);
      });
    return () => controller.abort();
  }, []);

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

  async function emailOtpGonder(ilkGonderim: boolean): Promise<boolean> {
    setCalisiyor(true);
    setGonderimHatasi(null);
    try {
      await mfaSendEmailOtp();
      setEmailGonderildi(true);
      if (!ilkGonderim) setCooldown(60);
      return true;
    } catch (e) {
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

        <button type="button" className="btn-link" onClick={() => navigate("/")}>
          Çıkış - Ana Sayfa
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
