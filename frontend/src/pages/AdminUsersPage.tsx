// Sistem yöneticisi kullanıcı yönetimi sayfası (Sprint 9).
// MFA doğrulanmış + SystemAdmin rolü ile erişilir.
// Özellikler:
//   - Kullanıcı listesi (rol filtresi, sayfalama)
//   - Yeni kullanıcı oluşturma (SystemAdmin/Ministry/Province rolü atanabilir)
//   - Oluşturulan kullanıcıya MFA zorunlu kılınır

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { adminCreateUser, adminListUsers } from "../services/admin";
import type { AdminRole, AdminUser } from "../services/admin";

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);
  const [liste, setListe] = useState<AdminUser[]>([]);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [rolFiltre, setRolFiltre] = useState<AdminRole | "">("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  // Yeni kullanıcı formu
  const [formAcik, setFormAcik] = useState(false);
  const [yeniEmail, setYeniEmail] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [yeniSoyad, setYeniSoyad] = useState("");
  const [yeniRol, setYeniRol] = useState<AdminRole>("MinistryOfficial");
  const [formHata, setFormHata] = useState<string | null>(null);
  const [formCalisiyor, setFormCalisiyor] = useState(false);
  const [basariMesaj, setBasariMesaj] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((u) => {
        const tumRoller = u.authenticated ? u.sessions.flatMap((s) => s.roles) : [];
        if (!tumRoller.includes("SystemAdmin")) {
          setHata("Bu sayfa yalnızca Sistem Yöneticileri içindir.");
        } else {
          setYetkiKontrolEdildi(true);
        }
      })
      .catch(() => setHata("Oturum bulunamadı. Lütfen giriş yapın."))
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    listeYukle(sayfa, rolFiltre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetkiKontrolEdildi, sayfa, rolFiltre]);

  async function listeYukle(s: number, r: AdminRole | "") {
    setYukleniyor(true);
    setHata(null);
    try {
      const sonuc = await adminListUsers({ sayfa: s, sayfaBasina: 25, rol: r });
      setListe(sonuc.kullanicilar);
      setToplam(sonuc.toplam);
    } catch (e) {
      setHata(e instanceof ApiHttpError ? e.message : "Liste yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }

  async function handleYeniKullanici(olay: FormEvent) {
    olay.preventDefault();
    setFormHata(null);
    setBasariMesaj(null);
    if (!yeniEmail.trim() || !yeniSifre || yeniSifre.length < 8 || !yeniAd.trim() || !yeniSoyad.trim()) {
      setFormHata("Tüm alanlar zorunlu; şifre en az 8 karakter.");
      return;
    }
    setFormCalisiyor(true);
    try {
      const sonuc = await adminCreateUser({
        email: yeniEmail.trim(),
        password: yeniSifre,
        firstName: yeniAd.trim(),
        lastName: yeniSoyad.trim(),
        role: yeniRol,
      });
      setBasariMesaj(`Kullanıcı oluşturuldu: ${sonuc.email} (${sonuc.role}). İlk girişte MFA kurulumu zorunlu.`);
      // Form temizle
      setYeniEmail("");
      setYeniSifre("");
      setYeniAd("");
      setYeniSoyad("");
      listeYukle(sayfa, rolFiltre);
    } catch (e) {
      setFormHata(e instanceof ApiHttpError ? e.message : "Kullanıcı oluşturulamadı.");
    } finally {
      setFormCalisiyor(false);
    }
  }

  if (yukleniyor && !yetkiKontrolEdildi) {
    return <main className="sayfa-ortak"><p>Yükleniyor…</p></main>;
  }

  if (hata && !yetkiKontrolEdildi) {
    return (
      <main className="sayfa-ortak">
        <div className="durum-banner durum-banner--hata" role="alert">
          <span>{hata}</span>
        </div>
        <button className="btn-ana" onClick={() => navigate("/")}>Ana sayfa</button>
      </main>
    );
  }

  const toplamSayfa = Math.max(1, Math.ceil(toplam / 25));

  return (
    <main className="sayfa-ortak admin-kullanicilar">
      <h1>Kullanıcı Yönetimi</h1>
      <p className="alt-aciklama">
        Sistem yöneticisi olarak yeni kullanıcı oluşturabilir ve mevcut kullanıcıları listeleyebilirsiniz.
      </p>

      <div className="admin-filtre">
        <label>
          <span>Rol filtresi</span>
          <select value={rolFiltre} onChange={(e) => { setRolFiltre(e.target.value as AdminRole | ""); setSayfa(1); }}>
            <option value="">Tümü</option>
            <option value="SystemAdmin">Sistem Yöneticisi</option>
            <option value="MinistryOfficial">Bakanlık Yetkilisi</option>
            <option value="ProvinceManager">İl AR-GE Yöneticisi</option>
            <option value="ProvinceEvaluator">İl Değerlendirici</option>
          </select>
        </label>
        <button className="btn-ana" onClick={() => setFormAcik(!formAcik)}>
          {formAcik ? "Formu kapat" : "+ Yeni kullanıcı"}
        </button>
      </div>

      {formAcik && (
        <form className="yeni-kullanici-form" onSubmit={handleYeniKullanici}>
          <h2>Yeni kullanıcı</h2>
          <div className="form-grid">
            <label>
              <span>Ad *</span>
              <input type="text" required value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} />
            </label>
            <label>
              <span>Soyad *</span>
              <input type="text" required value={yeniSoyad} onChange={(e) => setYeniSoyad(e.target.value)} />
            </label>
            <label>
              <span>E-posta *</span>
              <input type="email" required value={yeniEmail} onChange={(e) => setYeniEmail(e.target.value)} />
            </label>
            <label>
              <span>Şifre * (en az 8 karakter)</span>
              <input type="text" required minLength={8} value={yeniSifre} onChange={(e) => setYeniSifre(e.target.value)} />
            </label>
            <label>
              <span>Rol *</span>
              <select value={yeniRol} onChange={(e) => setYeniRol(e.target.value as AdminRole)}>
                <option value="MinistryOfficial">Bakanlık Yetkilisi</option>
                <option value="ProvinceManager">İl AR-GE Yöneticisi</option>
                <option value="ProvinceEvaluator">İl Değerlendirici</option>
                <option value="SystemAdmin">Sistem Yöneticisi</option>
              </select>
            </label>
          </div>
          {formHata && (
            <div className="durum-banner durum-banner--hata" role="alert">
              <span>{formHata}</span>
            </div>
          )}
          {basariMesaj && (
            <div className="durum-banner durum-banner--basari" role="status">
              <span>{basariMesaj}</span>
            </div>
          )}
          <button type="submit" className="btn-ana" disabled={formCalisiyor}>
            {formCalisiyor ? "Oluşturuluyor…" : "Kullanıcı oluştur"}
          </button>
        </form>
      )}

      <h2>Kullanıcılar ({toplam})</h2>
      {yukleniyor ? (
        <p>Yükleniyor…</p>
      ) : (
        <table className="kullanici-tablosu">
          <thead>
            <tr>
              <th>E-posta</th>
              <th>Ad Soyad</th>
              <th>MFA</th>
              <th>Şifre değişmeli</th>
              <th>E-posta onaylı</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 ? (
              <tr><td colSpan={5}>Bu filtreyle eşleşen kullanıcı yok.</td></tr>
            ) : (
              liste.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.twoFactorEnabled ? "✓" : "—"}</td>
                  <td>{u.mustChangePassword ? "✓" : "—"}</td>
                  <td>{u.emailConfirmed ? "✓" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {toplamSayfa > 1 && (
        <div className="sayfalama">
          <button disabled={sayfa <= 1} onClick={() => setSayfa(sayfa - 1)}>Önceki</button>
          <span>Sayfa {sayfa} / {toplamSayfa}</span>
          <button disabled={sayfa >= toplamSayfa} onClick={() => setSayfa(sayfa + 1)}>Sonraki</button>
        </div>
      )}
    </main>
  );
}
