// Yeni kullanıcı oluşturma — Sprint 11.
//
// Form: email, password, firstName, lastName, role (whitelist).

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALLOWED_ROLES, type AllowedRole, createUser } from "../../services/admin";
import { ApiHttpError } from "../../services/api";

export function UserCreatePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<AllowedRole>("ProvinceEvaluator");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setCalisiyor(true);
    try {
      await createUser({ email, password, firstName, lastName, role });
      navigate("/admin/users");
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Oluşturulamadı.");
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <form onSubmit={gonder} className="admin-form">
      <h2>Yeni Kullanıcı</h2>
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
        Geçici Şifre
        <input
          type="text"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="En az 8 karakter — kullanıcıya iletin, ilk girişte değiştirmesi istenir."
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
      <label>
        Rol
        <select value={role} onChange={(e) => setRole(e.target.value as AllowedRole)}>
          {ALLOWED_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div className="admin-form-actions">
        <button type="submit" disabled={calisiyor}>
          {calisiyor ? "Oluşturuluyor…" : "Oluştur"}
        </button>
        <button type="button" onClick={() => navigate("/admin/users")}>
          İptal
        </button>
      </div>
    </form>
  );
}
