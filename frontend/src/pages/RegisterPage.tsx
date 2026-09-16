import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { errorMessage } from "../api/client";
import { getProvinces, type ReferenceItem } from "../api/reference";
import { StatusBanner } from "../components/StatusBanner";

export function RegisterPage() {
  const navigate = useNavigate();
  const [provinces, setProvinces] = useState<ReferenceItem[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [provinceId, setProvinceId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getProvinces(controller.signal)
      .then(setProvinces)
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== passwordAgain) {
      setError("Şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        provinceId: Number(provinceId),
      });
      navigate("/giris", { replace: true, state: { registered: true } });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-wrap auth-form-wrap--wide">
      <div className="auth-title">
        <span className="auth-title__icon auth-title__icon--orange" aria-hidden="true">＋</span>
        <div>
          <p className="eyebrow">Aramıza katıl</p>
          <h2>Öğrenci hesabı oluştur</h2>
        </div>
      </div>
      <p className="form-intro">Fikrini paylaşabilmek için bilgilerini eksiksiz doldur.</p>
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Ad</span>
            <input autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={80} />
          </label>
          <label className="form-field">
            <span>Soyad</span>
            <input autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={80} />
          </label>
        </div>
        <label className="form-field">
          <span>E-posta adresi</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="form-field">
          <span>İl</span>
          <select value={provinceId} onChange={(event) => setProvinceId(event.target.value)} required>
            <option value="">İlini seç</option>
            {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
          <small>Göndereceğin fikirler seçtiğin ilin İl AR-GE birimine yönlendirilir.</small>
        </label>
        <div className="form-grid">
          <label className="form-field">
            <span>Şifre</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          <label className="form-field">
            <span>Şifre tekrar</span>
            <input type="password" autoComplete="new-password" value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} minLength={8} required />
          </label>
        </div>
        <p className="password-hint">En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter kullan.</p>
        <button className="primary-button" type="submit" disabled={isSubmitting || provinces.length === 0}>
          {isSubmitting ? "Hesap oluşturuluyor…" : "Hesabımı oluştur"}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>
      <p className="auth-switch">Zaten hesabın var mı? <Link to="/giris">Giriş yap</Link></p>
    </div>
  );
}
