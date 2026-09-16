import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import { errorMessage } from "../api/client";
import { StatusBanner } from "../components/StatusBanner";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasValidParameters = Boolean(email && token);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== passwordAgain) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await resetPassword(email, token, password);
      setMessage(result.message);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h1>Yeni şifreni belirle</h1>
      <p className="kart-not">Yeni şifreni iki kez yazarak onayla.</p>
      {!hasValidParameters && <StatusBanner tone="error">Sıfırlama bağlantısı eksik veya geçersiz.</StatusBanner>}
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}
      {hasValidParameters && !message && (
        <form onSubmit={handleSubmit}>
          <div className="alan">
            <span>Yeni şifre</span>
            <input className="ekip-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          <div className="alan" style={{ marginTop: "0.7rem" }}>
            <span>Yeni şifre tekrar</span>
            <input className="ekip-input" type="password" autoComplete="new-password" minLength={8} value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} required />
          </div>
          <button className="btn-ana btn-tam" type="submit" disabled={isSubmitting} style={{ marginTop: "1.1rem" }}>
            {isSubmitting ? "Güncelleniyor…" : "Şifremi güncelle"}
          </button>
        </form>
      )}
      <p className="kart-alt"><Link to="/giris">Giriş ekranına dön</Link></p>
    </>
  );
}
