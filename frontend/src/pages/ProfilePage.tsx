import { useEffect, useState, type FormEvent } from "react";
import { errorMessage } from "../api/client";
import { updateProfile } from "../api/profile";
import { getProvinces, type ReferenceItem } from "../api/reference";
import { useAuth } from "../auth/AuthContext";
import { StatusBanner } from "../components/StatusBanner";

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [provinces, setProvinces] = useState<ReferenceItem[]>([]);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [provinceId, setProvinceId] = useState(String(user?.profile?.provinceId ?? ""));
  const [district, setDistrict] = useState(user?.profile?.district ?? "");
  const [school, setSchool] = useState(user?.profile?.school ?? "");
  const [grade, setGrade] = useState(user?.profile?.grade ? String(user.profile.grade) : "");
  const [studentNumber, setStudentNumber] = useState(user?.profile?.studentNumber ?? "");
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await updateProfile({
        firstName,
        lastName,
        provinceId: Number(provinceId),
        district,
        school,
        grade: grade ? Number(grade) : null,
        studentNumber,
      });
      await refresh();
      setMessage(result.message);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-narrow">
      <div className="page-heading">
        <div><p className="eyebrow">Hesap bilgileri</p><h1>Profilim</h1><p>İl ve okul bilgilerin fikirlerinin doğru birime ulaşmasını sağlar.</p></div>
        <span className="email-badge">✓ {user?.email}</span>
      </div>

      <section className="profile-card">
        {message && <StatusBanner tone="success">{message}</StatusBanner>}
        {error && <StatusBanner tone="error">{error}</StatusBanner>}
        <form className="form-stack" onSubmit={handleSubmit}>
          <fieldset>
            <legend>Kişisel bilgiler</legend>
            <div className="form-grid">
              <label className="form-field"><span>Ad</span><input value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={80} /></label>
              <label className="form-field"><span>Soyad</span><input value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={80} /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Okul bilgileri</legend>
            <label className="form-field">
              <span>İl</span>
              <select value={provinceId} onChange={(event) => setProvinceId(event.target.value)} required>
                <option value="">İlini seç</option>
                {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
              </select>
              <small>İlini değiştirdiğinde yalnızca bundan sonra göndereceğin fikirler yeni ile yönlendirilir.</small>
            </label>
            <div className="form-grid">
              <label className="form-field"><span>İlçe</span><input value={district} onChange={(event) => setDistrict(event.target.value)} maxLength={60} /></label>
              <label className="form-field"><span>Okul</span><input value={school} onChange={(event) => setSchool(event.target.value)} maxLength={150} /></label>
              <label className="form-field"><span>Sınıf</span><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">Seçilmedi</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}. sınıf</option>)}</select></label>
              <label className="form-field"><span>Okul numarası</span><input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} maxLength={20} inputMode="numeric" /></label>
            </div>
          </fieldset>
          <div className="form-actions"><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button></div>
        </form>
      </section>
    </main>
  );
}
