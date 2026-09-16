import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import { errorMessage } from "../api/client";
import { StatusBanner } from "../components/StatusBanner";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-wrap">
      <div className="auth-title">
        <span className="auth-title__icon" aria-hidden="true">?</span>
        <div><p className="eyebrow">Hesap yardımı</p><h2>Şifreni sıfırla</h2></div>
      </div>
      <p className="form-intro">E-posta adresini yaz; hesabın varsa sıfırlama bağlantısını gönderelim.</p>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}
      {!message && (
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>E-posta adresi</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
          </button>
        </form>
      )}
      <p className="auth-switch"><Link to="/giris">← Giriş ekranına dön</Link></p>
    </div>
  );
}
