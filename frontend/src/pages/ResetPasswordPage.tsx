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
    <div className="auth-form-wrap">
      <div className="auth-title">
        <span className="auth-title__icon" aria-hidden="true">↻</span>
        <div><p className="eyebrow">Yeni başlangıç</p><h2>Yeni şifreni belirle</h2></div>
      </div>
      {!hasValidParameters && <StatusBanner tone="error">Sıfırlama bağlantısı eksik veya geçersiz.</StatusBanner>}
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}
      {hasValidParameters && !message && (
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="form-field"><span>Yeni şifre</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label className="form-field"><span>Yeni şifre tekrar</span><input type="password" autoComplete="new-password" minLength={8} value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} required /></label>
          <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Güncelleniyor…" : "Şifremi güncelle"}</button>
        </form>
      )}
      <p className="auth-switch"><Link to="/giris">Giriş ekranına dön</Link></p>
    </div>
  );
}
