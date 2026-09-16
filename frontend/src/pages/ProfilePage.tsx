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
    <section className="fikir-karti" style={{ textAlign: "left" }}>
      <h1 style={{ fontSize: "1.7rem" }}>Profilim</h1>
      <p className="kart-not">İl ve okul bilgilerin fikirlerinin doğru birime ulaşmasını sağlar.</p>
      {message && <StatusBanner tone="success">{message}</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <div className="bolum-basligi turkuaz">Kişisel bilgiler</div>
      <div className="iki-sutun">
        <label className="alan">
          <span>Ad</span>
          <input className="ekip-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={80} />
        </label>
        <label className="alan">
          <span>Soyad</span>
          <input className="ekip-input" value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={80} />
        </label>
      </div>

      <div className="bolum-basligi mavi">Okul bilgileri</div>
      <label className="alan">
        <span>İl</span>
        <select className="ekip-input" value={provinceId} onChange={(event) => setProvinceId(event.target.value)} required>
          <option value="">İlini seç</option>
          {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
        </select>
        <span className="not">İlini değiştirdiğinde yalnızca bundan sonra göndereceğin fikirler yeni ile yönlendirilir.</span>
      </label>
      <div className="iki-sutun" style={{ marginTop: "0.7rem" }}>
        <label className="alan">
          <span>İlçe</span>
          <input value={district} onChange={(event) => setDistrict(event.target.value)} maxLength={60} />
        </label>
        <label className="alan">
          <span>Okul</span>
          <input value={school} onChange={(event) => setSchool(event.target.value)} maxLength={150} />
        </label>
        <label className="alan">
          <span>Sınıf</span>
          <select value={grade} onChange={(event) => setGrade(event.target.value)}>
            <option value="">Seçilmedi</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}. sınıf</option>)}
          </select>
        </label>
        <label className="alan">
          <span>Okul numarası</span>
          <input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} maxLength={20} inputMode="numeric" />
        </label>
      </div>

      <div className="bolum-basligi turuncu">Kaydet</div>
      <form onSubmit={handleSubmit}>
        <button className="btn-ana btn-tam" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
        </button>
      </form>
    </section>
  );
}
