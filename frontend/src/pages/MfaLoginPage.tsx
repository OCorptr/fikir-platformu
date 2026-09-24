// MFA login sayfası (Sprint 9).
// Login sonrası backend mfaRequired:true döndürdüğünde yönlendirilir.
// Kullanıcı 6 haneli kodu girer → /api/auth/mfa/verify → scheme upgrade.

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { mfaLoginVerify } from "../services/auth";

export function MfaLoginPage() {
  const navigate = useNavigate();
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

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

  return (
    <main className="sayfa-ortak mfa-login">
      <h1>İki adımlı doğrulama</h1>
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
