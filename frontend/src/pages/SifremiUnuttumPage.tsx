// Şifremi Unuttum sayfası — Sprint 11.5.
//
// Kullanıcı email adresini girer. Backend /api/auth/forgot-password'a
// POST. Response her zaman aynı generic mesajdır (email enumeration koruması).

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest, ApiHttpError } from "../services/api";

export function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    setMesaj(null);
    setCalisiyor(true);
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setMesaj(
        "Eğer bu e-posta bir hesaba kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Lütfen e-postanızı kontrol edin. Bağlantı 1 saat geçerlidir.",
      );
    } catch (err) {
      setMesaj(
        err instanceof ApiHttpError
          ? err.message
          : "Şifremi unuttum isteği gönderilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <main className="sayfa-index">
      <section className="auth-modal-kart genis" aria-labelledby="sifremi-baslik">
        <h2 id="sifremi-baslik">Şifremi Unuttum</h2>
        <p>
          Hesabınıza kayıtlı e-posta adresini girin. Şifre sıfırlama
          bağlantısı e-postanıza gönderilecek.
        </p>

        {mesaj && (
          <div role="status" aria-live="polite" className="auth-modal-durum">
            {mesaj}
          </div>
        )}

        <form onSubmit={gonder} className="auth-modal-form">
          <label>
            E-posta
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={calisiyor}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={calisiyor}>
            {calisiyor ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
          </button>
        </form>

        <p className="auth-modal-alt-link">
          <Link to="/giris">← Giriş ekranına dön</Link>
        </p>
      </section>
    </main>
  );
}
