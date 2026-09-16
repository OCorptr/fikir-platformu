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
    <>
      <h1>Öğrenci hesabı oluştur</h1>
      <p className="kart-not">Fikrini paylaşabilmek için bilgilerini eksiksiz doldur.</p>
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <div className="bolum-basligi turkuaz">Kimlik bilgileri</div>
      <form onSubmit={handleSubmit}>
        <div className="iki-sutun">
          <label className="alan">
            <span>Ad</span>
            <input className="ekip-input" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={80} />
          </label>
          <label className="alan">
            <span>Soyad</span>
            <input className="ekip-input" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={80} />
          </label>
        </div>
        <label className="alan" style={{ marginTop: "0.7rem" }}>
          <span>E-posta adresi</span>
          <input className="ekip-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <div className="bolum-basligi mavi">Okul bilgileri</div>
        <label className="alan">
          <span>İl</span>
          <select className="ekip-input" value={provinceId} onChange={(event) => setProvinceId(event.target.value)} required>
            <option value="">İlini seç</option>
            {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
          <span className="not">Göndereceğin fikirler seçtiğin ilin İl AR-GE birimine yönlenir.</span>
        </label>

        <div className="bolum-basligi turuncu">Güvenlik</div>
        <label className="alan">
          <span>Şifre</span>
          <input className="ekip-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          <span className="not">En az 8 karakter; büyük harf, küçük harf, rakam ve özel karakter kullan.</span>
        </label>
        <label className="alan" style={{ marginTop: "0.7rem" }}>
          <span>Şifre tekrar</span>
          <input className="ekip-input" type="password" autoComplete="new-password" value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} required minLength={8} />
        </label>

        <button className="btn-ana btn-tam" type="submit" disabled={isSubmitting} style={{ marginTop: "1.1rem" }}>
          {isSubmitting ? "Hesabın oluşturuluyor…" : "Hesabımı oluştur"}
        </button>
      </form>

      <p className="kart-alt">Hesabın var mı? <Link to="/giris">Giriş yap</Link></p>
    </>
  );
}
