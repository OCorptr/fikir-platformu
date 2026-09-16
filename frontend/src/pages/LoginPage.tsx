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
    <>
      <h1>Hesabına giriş yap</h1>
      <p className="kart-not">E-posta adresin ve şifrenle hesabına giriş yapabilirsin.</p>

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

      <div className="bolum-basligi mavi">Giriş bilgileri</div>
      <form onSubmit={handleSubmit}>
        <div className="alan">
          <span>E-posta adresi</span>
          <input
            className="ekip-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@meb.gov.tr"
            required
          />
        </div>
        <div className="alan" style={{ marginTop: "0.7rem" }}>
          <span>Şifre</span>
          <input
            className="ekip-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div className="satir" style={{ marginTop: "0.9rem" }}>
          <label className="satir">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Beni hatırla</span>
          </label>
          <Link className="saga-yasla" to="/sifremi-unuttum">Şifremi unuttum</Link>
        </div>

        <button className="btn-ana btn-tam" type="submit" disabled={isSubmitting} style={{ marginTop: "1.1rem" }}>
          {isSubmitting ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>

      <p className="kart-alt">Hesabın yok mu? <Link to="/kayit">Kayıt ol</Link></p>
    </>
  );
}
