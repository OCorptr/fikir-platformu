// MFA login sayfası (Sprint 10 — method-aware + flexible verify).
// Login sonrası backend mfaRequired:true döndürdüğünde yönlendirilir.
// Kullanıcının kayıtlı yöntemi (TOTP veya Email) ne olursa olsun,
// bu sayfada HER İKİ yöntemi de kullanabilir:
//   - TOTP: Authenticator uygulamasından 6 haneli kod
//   - Email: e-posta adresine gönderilen 6 haneli OTP (5dk TTL)
// İlk açılışta kullanıcının kayıtlı yöntemi seçili gelir (daha az tıklama).

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { mfaGetMethod, mfaLoginVerify, mfaSendEmailOtp } from "../services/auth";

type Method = "Totp" | "Email" | "Yukleniyor" | "Bilinmiyor";

export function MfaLoginPage() {
  const navigate = useNavigate();
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [aktifYontem, setAktifYontem] = useState<Method>("Yukleniyor");
  const [kayitliYontem, setKayitliYontem] = useState<Method>("Bilinmiyor");
  const [emailGonderildi, setEmailGonderildi] = useState(false);
  const [gonderimHatasi, setGonderimHatasi] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0); // saniye

  // Sayfa açıldığında: kullanıcının kayıtlı MFA method'unu /api/auth/mfa/method'dan al.
  useEffect(() => {
    const controller = new AbortController();
    mfaGetMethod()
      .then(async (m) => {
        const yontem: Method = m.method === "Email" ? "Email" : "Totp";
        setKayitliYontem(yontem);
        setAktifYontem(yontem);
        // Email method ise otomatik kod gönder.
        if (yontem === "Email") {
          await trySendEmailOtp();
          setEmailGonderildi(true);
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setHata(e instanceof ApiHttpError ? e.message : "MFA yöntemi algılanamadı.");
        // Yine de kullanıcıya fallback: TOTP ekranını aç (yöntem seçimi olmadan).
        setKayitliYontem("Bilinmiyor");
        setAktifYontem("Totp");
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

  async function trySendEmailOtp(sessiz: boolean = true): Promise<boolean> {
    try {
      await mfaSendEmailOtp();
      if (!sessiz) setEmailGonderildi(true);
      return true;
    } catch {
      return false;
    }
  }

  async function handleEmailKoduGonder() {
    setCalisiyor(true);
    setGonderimHatasi(null);
    setHata(null);
    try {
      const ok = await mfaSendEmailOtp();
      if (ok) {
        setEmailGonderildi(true);
        setAktifYontem("Email");
        setKod("");
        setCooldown(60);
      } else {
        setGonderimHatasi("Kod gönderilemedi, tekrar deneyin.");
      }
    } catch (e) {
      setGonderimHatasi(e instanceof ApiHttpError ? e.message : "Kod gönderilemedi.");
    } finally {
      setCalisiyor(false);
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

  function handleYontemDegistir(yeniYontem: Method) {
    if (aktifYontem === yeniYontem) return;
    setAktifYontem(yeniYontem);
    setKod("");
    setHata(null);
    setGonderimHatasi(null);
    // Email'e geçtiyse otomatik kod gönder (eğer daha önce gönderilmemişse).
    if (yeniYontem === "Email" && !emailGonderildi) {
      void handleEmailKoduGonder();
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
  if (aktifYontem === "Yukleniyor") {
    return (
      <main className="sayfa-ortak mfa-login">
        <p>MFA yöntemi algılanıyor…</p>
      </main>
    );
  }

  // Aktif yöntem başlığı
  const baslik = aktifYontem === "Email" ? "📧 E-posta doğrulama" : "📱 İki adımlı doğrulama";
  const aciklama =
    aktifYontem === "Email"
      ? emailGonderildi
        ? "E-posta adresinize 6 haneli kod gönderdik. Kodu aşağıya girin."
        : "E-posta kodu hazırlanıyor…"
      : "Authenticator uygulamanızda görünen 6 haneli kodu girin.";

  return (
    <main className="sayfa-ortak mfa-login">
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

      {/* Yöntem değiştirme bağlantıları — her iki yöntem de deneyebilir */}
      <div className="mfa-yontem-degistir">
        {aktifYontem === "Totp" ? (
          <button
            type="button"
            className="btn-link"
            onClick={() => handleYontemDegistir("Email")}
            disabled={calisiyor}
          >
            {cooldown > 0 && emailGonderildi
              ? `Kodu tekrar gönder (${cooldown}sn)`
              : "E-posta kodu gönder"}
          </button>
        ) : (
          <>
            {emailGonderildi && (
              <button
                type="button"
                className="btn-link"
                onClick={handleTekrarGonder}
                disabled={cooldown > 0 || calisiyor}
              >
                {cooldown > 0 ? `Kodu tekrar gönder (${cooldown}sn)` : "Kodu tekrar gönder"}
              </button>
            )}
            {kayitliYontem === "Totp" && (
              <button
                type="button"
                className="btn-link"
                onClick={() => handleYontemDegistir("Totp")}
                disabled={calisiyor}
              >
                Bunun yerine Authenticator kodu kullan
              </button>
            )}
          </>
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
      </div>

      <button type="button" className="btn-link" onClick={() => navigate("/")}>
        Ana sayfaya dön
      </button>
    </main>
  );
}
