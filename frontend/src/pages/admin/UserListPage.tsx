// Kullanıcı listesi — Sprint 11.3 Admin Panel.
//
// Tablo: email, ad, MFA enabled, lockout.
// Filtre: rol.
// Sayfalama: sayfa başına 25 (backend default).
// Butonlar: yeni, düzenle, MFA reset, şifre reset, sil.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ALLOWED_ROLES,
  type AllowedRole,
  listUsers,
  deleteUser,
  resetUserMfa,
  resetUserPassword,
  changeUserRole,
  type AdminUserListItem,
} from "../../services/admin";
import { ApiHttpError } from "../../services/api";

const SAYFA_BASINA = 25;

export function UserListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [rolFiltre, setRolFiltre] = useState<AllowedRole | "">("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(true);

  async function yukle() {
    setHata(null);
    setCalisiyor(true);
    try {
      const sonuc = await listUsers({
        sayfa,
        sayfaBasina: SAYFA_BASINA,
        role: rolFiltre ? (rolFiltre as AllowedRole) : undefined,
      });
      setItems(sonuc.kullanicilar);
      setToplam(sonuc.toplam);
    } catch (err) {
      setHata(
        err instanceof ApiHttpError ? err.message : "Kullanıcılar yüklenemedi.",
      );
      setItems([]);
      setToplam(0);
    } finally {
      setCalisiyor(false);
    }
  }

  useEffect(() => {
    void yukle();
    // rolFiltre/sayfa değiştiğinde yeniden yükle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sayfa, rolFiltre]);

  async function silKullanici(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" silinsin mi? Bu geri alınamaz.`)) return;
    try {
      await deleteUser(item.id);
      await yukle();
    } catch (err) {
      setHata(
        err instanceof ApiHttpError ? err.message : "Silinemedi.",
      );
    }
  }

  async function mfaReset(item: AdminUserListItem) {
    if (
      !confirm(
        `"${item.email}" MFA sıfırlansın mı? Telefon kayıp senaryosu; kullanıcı sonraki login'de yeniden setup yapacak.`,
      )
    )
      return;
    try {
      const sonuc = await resetUserMfa(item.id);
      alert(sonuc.message);
      await yukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "MFA sıfırlanamadı.");
    }
  }

  async function sifreReset(item: AdminUserListItem) {
    if (
      !confirm(
        `"${item.email}" için force password reset başlatılsın mı? Üretilen link kullanıcıya iletilmeli (email veya başka güvenli kanal).`,
      )
    )
      return;
    try {
      const sonuc = await resetUserPassword(item.id);
      prompt("Reset URL'i kopyalayıp kullanıcıya iletin:", sonuc.resetUrl);
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Şifre sıfırlanamadı.");
    }
  }

  async function rolDegistir(item: AdminUserListItem, newRole: AllowedRole) {
    try {
      const sonuc = await changeUserRole(item.id, { newRole });
      alert(
        `"${item.email}" rolü güncellendi: ${sonuc.oncekiRoller.join(", ") || "(yok)"} → ${sonuc.yeniRol}`,
      );
      await yukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Rol atanamadı.");
    }
  }

  const toplamSayfa = Math.max(1, Math.ceil(toplam / SAYFA_BASINA));

  return (
    <section className="admin-liste">
      <div className="admin-filtreler">
        <label>
          Rol:
          <select
            value={rolFiltre}
            onChange={(e) => {
              setRolFiltre(e.target.value as AllowedRole | "");
              setSayfa(1);
            }}
          >
            <option value="">Tümü (whitelist)</option>
            {ALLOWED_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <Link to="/admin/users/new" className="btn btn-primary">
          + Yeni Kullanıcı
        </Link>
      </div>

      {hata && <div className="admin-hata">{hata}</div>}

      {calisiyor && items.length === 0 ? (
        <p>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p>Bu filtreyle eşleşen kullanıcı yok.</p>
      ) : (
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>E-posta</th>
              <th>Ad Soyad</th>
              <th>Rol</th>
              <th>MFA</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td>
                  <select
                    value={""}
                    onChange={(e) => {
                      const next = e.target.value as AllowedRole;
                      e.target.value = "";
                      if (next) void rolDegistir(u, next);
                    }}
                  >
                    <option value="">Rol ata…</option>
                    {ALLOWED_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.twoFactorEnabled ? "✓" : "—"}</td>
                <td className="admin-islemler">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    Düzenle
                  </button>
                  <button type="button" onClick={() => mfaReset(u)}>
                    MFA reset
                  </button>
                  <button type="button" onClick={() => sifreReset(u)}>
                    Şifre reset
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => silKullanici(u)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <nav className="admin-sayfalama">
        <button
          type="button"
          disabled={sayfa <= 1 || calisiyor}
          onClick={() => setSayfa((s) => Math.max(1, s - 1))}
        >
          ← Önceki
        </button>
        <span>
          Sayfa {sayfa} / {toplamSayfa} (toplam {toplam})
        </span>
        <button
          type="button"
          disabled={sayfa >= toplamSayfa || calisiyor}
          onClick={() => setSayfa((s) => s + 1)}
        >
          Sonraki →
        </button>
      </nav>
    </section>
  );
}
