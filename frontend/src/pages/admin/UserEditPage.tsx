// Kullanıcı düzenleme — Sprint 11.
//
// Form: email, firstName, lastName. Rol atama tablo içinden inline yapılır.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getUser, updateUser, type AdminUserDetail } from "../../services/admin";
import { rolAdi } from "../../services/roles";
import { ApiHttpError } from "../../services/api";

export function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const bilgi = await getUser(id);
        if (cancelled) return;
        setUser(bilgi);
        setEmail(bilgi.email);
        setFirstName(bilgi.firstName);
        setLastName(bilgi.lastName);
      } catch (err) {
        if (!cancelled) {
          setHata(
            err instanceof ApiHttpError ? err.message : "Kullanıcı yüklenemedi.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setHata(null);
    setCalisiyor(true);
    try {
      await updateUser(id, { email, firstName, lastName });
      navigate("/admin/users");
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Güncellenemedi.");
    } finally {
      setCalisiyor(false);
    }
  }

  if (!id) {
    return <p>Geçersiz kullanıcı.</p>;
  }
  if (hata && !user) {
    return <div className="admin-hata">{hata}</div>;
  }
  if (!user) {
    return <p>Yükleniyor…</p>;
  }

  return (
    <form onSubmit={gonder} className="admin-form">
      <h2>{user.email}</h2>
      <p className="admin-form-meta">
        Roller: {user.roles.length > 0 ? user.roles.map(rolAdi).join(", ") : "(yok)"} · MFA:{" "}
        {user.twoFactorEnabled ? "etkin" : "kapalı"} · Son giriş:{" "}
        {user.sonGirisAt ? new Date(user.sonGirisAt).toLocaleString("tr-TR") : "—"}
      </p>
      {hata && <div className="admin-hata">{hata}</div>}

      <label>
        E-posta
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Ad
        <input
          type="text"
          required
          minLength={2}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
      </label>
      <label>
        Soyad
        <input
          type="text"
          required
          minLength={2}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </label>

      <div className="admin-form-actions">
        <button type="submit" disabled={calisiyor}>
          {calisiyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button type="button" onClick={() => navigate("/admin/users")}>
          İptal
        </button>
      </div>
    </form>
  );
}
