// Yeni kullanıcı oluşturma — Sprint 11.1 (CRUD).
// Sprint 11.12: URL query parametreleri (role, ilKodu) preset'lenir —
// UserListPage'teki grup/il bazlı "+ Ekle" butonlarından gelen navigation'ı destekler.
//
// Form: email, password, firstName, lastName, role (whitelist), ilKodu (opsiyonel).

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ALLOWED_ROLES,
  type AllowedRole,
  createUser,
} from "../../services/admin";
import { getProvinces } from "../../services/references";
import { rolAdi } from "../../services/roles";
import type { ProvinceRef } from "../../types";
import { ApiHttpError } from "../../services/api";

export function UserCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rolParam = searchParams.get("role") as AllowedRole | null;
  const ilKoduParam = searchParams.get("ilKodu");
  const presetRol: AllowedRole =
    rolParam && (ALLOWED_ROLES as readonly string[]).includes(rolParam)
      ? rolParam
      : "ProvinceEvaluator";
  const presetIlKodu = ilKoduParam ? Number(ilKoduParam) : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<AllowedRole>(presetRol);
  const [ilKodu, setIlKodu] = useState<number | "">(presetIlKodu ?? "");
  const [iller, setIller] = useState<ProvinceRef[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    getProvinces().then(setIller).catch(() => setIller([]));
  }, []);

  const ilSecimiGerekli =
    role === "ProvinceManager" || role === "ProvinceEvaluator";

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setCalisiyor(true);
    try {
      await createUser({
        email,
        password,
        firstName,
        lastName,
        role,
        ilKodu: ilSecimiGerekli && ilKodu ? Number(ilKodu) : undefined,
      });
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
      <p className="admin-form-aciklama">
        {presetIlKodu !== null
          ? `İl: ${iller.find((i) => i.id === presetIlKodu)?.name ?? presetIlKodu} · `
          : ""}
        Rol: {rolAdi(presetRol)}
      </p>
      {hata && <div className="admin-hata">{hata}</div>}

      <label>
        E-posta
        <input
          type="email"
          required
          autoComplete="off"
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
          autoComplete="off"
          spellCheck={false}
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
          autoComplete="off"
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
          autoComplete="off"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </label>
      <label>
        Rol
        <select
          value={role}
          onChange={(e) => {
            const yeniRol = e.target.value as AllowedRole;
            setRole(yeniRol);
            // İl ataması gerekmeyen role geçilirse ilKodu temizle.
            if (yeniRol !== "ProvinceManager" && yeniRol !== "ProvinceEvaluator") {
              setIlKodu("");
            } else if (!ilKodu && presetIlKodu !== null) {
              setIlKodu(presetIlKodu);
            }
          }}
        >
          {ALLOWED_ROLES.map((r) => (
            <option key={r} value={r}>
              {rolAdi(r)}
            </option>
          ))}
        </select>
      </label>
      {ilSecimiGerekli && (
        <label>
          İl
          <select
            value={ilKodu === "" ? "" : String(ilKodu)}
            onChange={(e) =>
              setIlKodu(e.target.value === "" ? "" : Number(e.target.value))
            }
            required
          >
            <option value="">İl seçin…</option>
            {iller.map((i) => (
              <option key={i.id} value={i.id}>
                {String(i.id).padStart(2, "0")} — {i.name}
              </option>
            ))}
          </select>
        </label>
      )}

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
