// Şifre Sıfırlama sayfası — Sprint 11.5 + 11.16.
//
// URL: /sifre-sifirla?token=...&userId=...   (Admin Panel'den gelen — Sprint 11+)
//   veya: /sifre-sifirla?token=...&email=... (forgot-password akışı — Sprint 11.5)
// Kullanıcı yeni şifre girer; backend ResetPassword.

import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, ApiHttpError } from "../services/api";

export function SifreSifirlaPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const userId = params.get("userId") ?? "";
  const email = params.get("email") ?? "";

  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [basarili, setBasarili] = useState(false);

  // Token + (userId | email) zorunlu. Admin linkleri userId ile, klasik akış email ile gelir.
  const urlDolu = token.length > 0 && (userId.length > 0 || email.length > 0);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    setHata(null);

    if (yeniSifre !== yeniSifreTekrar) {
      setHata("Yeni şifre ve tekrarı eşleşmiyor.");
      return;
    }
    if (yeniSifre.length < 8) {
      setHata("Yeni şifre en az 8 karakter olmalıdır.");
      return;
    }

    setCalisiyor(true);
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: {
          userId: userId.trim() || undefined,
          email: email.trim() || undefined,
          token: token,
          newPassword: yeniSifre,
        },
      });
      setBasarili(true);
    } catch (err) {
      setHata(
        err instanceof ApiHttpError
          ? err.message
          : "Şifre sıfırlanamadı. Bağlantınızın süresi dolmuş olabilir.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  if (!urlDolu) {
    return (
      <main className="sayfa-index">
        <section className="auth-modal-kart genis" aria-labelledby="ss-hatasi">
          <h2 id="ss-hatasi">Geçersiz Şifre Sıfırlama Bağlantısı</h2>
          <p>Bu bağlantı geçersiz veya süresi dolmuş.</p>
          <p>
            <Link to="/sifremi-unuttum">Yeni sıfırlama bağlantısı isteyin</Link>
          </p>
          <p>
            <Link to="/giris">← Giriş ekranına dön</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="sayfa-index">
      <section
        className="auth-modal-kart genis"
        aria-labelledby="sifre-sifirla-baslik"
      >
        <h2 id="sifre-sifirla-baslik">Şifre Sıfırlama</h2>
        <p>
          <strong>{email || userId}</strong> için yeni şifre belirleyin.
        </p>

        {basarili ? (
          <>
            <div role="status" aria-live="polite" className="auth-modal-durum">
              Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/giris")}
            >
              Giriş ekranına git
            </button>
          </>
        ) : (
          <>
            {hata && <div className="auth-modal-hata">{hata}</div>}
            <form onSubmit={gonder} className="auth-modal-form">
              <label>
                Yeni Şifre
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={yeniSifre}
                  onChange={(e) => setYeniSifre(e.target.value)}
                  disabled={calisiyor}
                />
              </label>
              <label>
                Yeni Şifre Tekrar
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={yeniSifreTekrar}
                  onChange={(e) => setYeniSifreTekrar(e.target.value)}
                  disabled={calisiyor}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={calisiyor}
              >
                {calisiyor ? "Sıfırlanıyor…" : "Şifreyi Sıfırla"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
