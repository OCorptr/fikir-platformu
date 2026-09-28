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
    return (
      <div className="adm-sayfa">
        <div className="adm-bildirim adm-bildirim-hata" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>Geçersiz kullanıcı bağlantısı.</span>
        </div>
      </div>
    );
  }
  if (hata && !user) {
    return (
      <div className="adm-sayfa">
        <div className="adm-bildirim adm-bildirim-hata" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{hata}</span>
        </div>
      </div>
    );
  }
  if (!user) {
    return <div className="adm-yukleniyor">Yükleniyor…</div>;
  }

  return (
    <form onSubmit={gonder} className="adm-sayfa">
      <h2 className="adm-h2" style={{ marginTop: 0 }}>
        {user.email}
      </h2>
      <p className="adm-aciklama">
        <span className="adm-rozet adm-rozet-mavi">
          Roller:{" "}
          {user.roles.length > 0 ? user.roles.map(rolAdi).join(", ") : "(yok)"}
        </span>{" "}
        <span className="adm-rozet">
          MFA: {user.twoFactorEnabled ? "etkin" : "kapalı"}
        </span>{" "}
        <span className="adm-rozet">
          Son giriş:{" "}
          {user.sonGirisAt
            ? new Date(user.sonGirisAt).toLocaleString("tr-TR")
            : "—"}
        </span>
      </p>

      {hata && (
        <div className="adm-bildirim adm-bildirim-hata" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{hata}</span>
        </div>
      )}

      <section className="adm-kart" aria-labelledby="adm-kimlik-baslik">
        <h3 id="adm-kimlik-baslik" className="adm-h2" style={{ marginTop: 0 }}>
          Kimlik bilgileri
        </h3>

        <div className="adm-izgara">
          <label className="adm-alan">
            <span className="adm-etiket">E-posta</span>
            <input
              className="adm-input"
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="adm-alan">
            <span className="adm-etiket">Ad</span>
            <input
              className="adm-input"
              type="text"
              name="firstName"
              autoComplete="given-name"
              required
              minLength={2}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="adm-alan">
            <span className="adm-etiket">Soyad</span>
            <input
              className="adm-input"
              type="text"
              name="lastName"
              autoComplete="family-name"
              required
              minLength={2}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
        </div>

        <div className="adm-btn-kuyruk">
          <button
            type="submit"
            className="adm-btn adm-btn-ana"
            disabled={calisiyor}
          >
            {calisiyor ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-sessiz"
            onClick={() => navigate("/admin/users")}
            disabled={calisiyor}
          >
            İptal
          </button>
        </div>
      </section>
    </form>
  );
}
