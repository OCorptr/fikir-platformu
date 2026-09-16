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
    <>
      <h1>Şifreni sıfırla</h1>
      <p className="kart-not">E-posta adresini yaz; hesabın varsa sıfırlama bağlantısını gönderelim.</p>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}
      {!message && (
        <form onSubmit={handleSubmit}>
          <div className="alan">
            <span>E-posta adresi</span>
            <input className="ekip-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <button className="btn-ana btn-tam" type="submit" disabled={isSubmitting} style={{ marginTop: "1.1rem" }}>
            {isSubmitting ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
          </button>
        </form>
      )}
      <p className="kart-alt"><Link to="/giris">← Giriş ekranına dön</Link></p>
    </>
  );
}
