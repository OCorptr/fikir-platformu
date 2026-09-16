import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { StatusBanner } from "../components/StatusBanner";

type LocationState = { from?: string; registered?: boolean };

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as LocationState | null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password, rememberMe);
      navigate(state?.from ?? "/", { replace: true });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const verification = searchParams.get("verified");

  return (
    <div className="auth-form-wrap">
      <div className="auth-title">
        <span className="auth-title__icon" aria-hidden="true">→</span>
        <div>
          <p className="eyebrow">Tekrar hoş geldin</p>
          <h2>Hesabına giriş yap</h2>
        </div>
      </div>

      {state?.registered && (
        <StatusBanner tone="success">
          Kaydın oluşturuldu. Giriş yapmadan önce e-posta adresine gönderilen bağlantıyı açmalısın.
        </StatusBanner>
      )}
      {verification === "success" && (
        <StatusBanner tone="success">E-posta adresin doğrulandı. Artık giriş yapabilirsin.</StatusBanner>
      )}
      {verification === "invalid" && (
        <StatusBanner tone="error">Doğrulama bağlantısı geçersiz veya süresi dolmuş.</StatusBanner>
      )}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <form className="form-stack" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>E-posta adresi</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@meb.gov.tr"
            required
          />
        </label>
        <label className="form-field">
          <span>Şifre</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <div className="form-options">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Beni hatırla</span>
          </label>
          <Link to="/sifremi-unuttum">Şifremi unuttum</Link>
        </div>

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Giriş yapılıyor…" : "Giriş yap"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <p className="auth-switch">Hesabın yok mu? <Link to="/kayit">Kayıt ol</Link></p>
    </div>
  );
}
