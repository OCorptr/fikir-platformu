// Kullanıcı Yönetimi sayfası — Sprint 11.8 yeniden tasarım.
//
// Vercel Web Interface Guidelines'a göre düzenlendi:
// - Üç katmanlı grup yapısı (Sistem Yöneticileri, Bakanlık Yetkilileri,
//   İl AR-GE Yöneticileri, İl Değerlendiricileri).
// - İl AR-GE grupları kendi içinde şehirlere göre alt gruplara ayrılır.
// - URL'de rol filtresi senkronize (deep-link + Cmd/Ctrl-click).
// - Icon buttonlar aria-label, focus-visible, klavye erişilebilir.
// - Boş durumlar açıklanmış, skeleton yükleniyor…, hata aria-live.
// - Vercel "no transition: all", "honor prefers-reduced-motion" kuralları.

import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ALLOWED_ROLES,
  type AllowedRole,
  listUsers,
  deleteUser,
  resetUserMfa,
  resetUserPassword,
  changeUserRole,
  type AdminUserListItem,
  type AdminUserIlAtamasi,
} from "../../services/admin";
import { ApiHttpError } from "../../services/api";

const SAYFA_BASINA = 100;

type GrupKodu = "Sistem" | "Bakanlik" | "IlManager" | "IlEvaluator";

const GRUP_BASLIKLARI: Record<GrupKodu, string> = {
  Sistem: "Sistem Yöneticileri",
  Bakanlik: "Bakanlık Yetkilileri",
  IlManager: "İl AR-GE Yöneticileri",
  IlEvaluator: "İl Değerlendiricileri",
};

const GRUP_ACIKLAMALARI: Record<GrupKodu, string> = {
  Sistem: "Tüm platform yönetim yetkisi (YEGİTEK için).",
  Bakanlik: "Bakanlık düzeyinde değerlendirme ve raporlama.",
  IlManager: "İl AR-GE birimi yöneticileri — kendi iline atanmış.",
  IlEvaluator: "İl AR-GE değerlendiricileri — yöneticinin ekibinde.",
};

function grupBelirle(roller: string[]): GrupKodu {
  if (roller.includes("SystemAdmin")) return "Sistem";
  if (roller.includes("MinistryOfficial")) return "Bakanlik";
  if (roller.includes("ProvinceManager")) return "IlManager";
  if (roller.includes("ProvinceEvaluator")) return "IlEvaluator";
  return "Bakanlik"; // fallback
}

function ilBul(roller: string[], ilAtamalari: AdminUserIlAtamasi[]): AdminUserIlAtamasi | null {
  // İlk whitelist il atamasını döner.
  const whitelist = new Set(["ProvinceManager", "ProvinceEvaluator"]);
  const match = ilAtamalari.find((ia) => whitelist.has(ia.role));
  return match ?? null;
}

export function UserListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rolFilter = (searchParams.get("rol") ?? "") as AllowedRole | "";
  const searchTerm = searchParams.get("q") ?? "";

  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [toplam, setToplam] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(true);

  // Accordion açık/kapalı (default: hepsi açık). LocalStorage'da hatırla.
  const [acikGruplar, setAcikGruplar] = useState<Record<GrupKodu, boolean>>(() => {
    try {
      const stored = localStorage.getItem("admin.acikGruplar");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return { Sistem: true, Bakanlik: true, IlManager: true, IlEvaluator: true };
  });

  useEffect(() => {
    localStorage.setItem("admin.acikGruplar", JSON.stringify(acikGruplar));
  }, [acikGruplar]);

  async function yukle() {
    setHata(null);
    setCalisiyor(true);
    try {
      const sonuc = await listUsers({
        sayfa: 1,
        sayfaBasina: SAYFA_BASINA,
        role: rolFilter ? (rolFilter as AllowedRole) : undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolFilter]);

  function filterGuncelle(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  const filtrelenmis = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter((u) =>
      [u.email, u.firstName, u.lastName, ...(u.ilAtamalari?.map((i) => i.ilAdi) ?? [])]
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [items, searchTerm]);

  const gruplar = useMemo(() => {
    const buckets: Record<GrupKodu, AdminUserListItem[]> = {
      Sistem: [], Bakanlik: [], IlManager: [], IlEvaluator: [],
    };
    for (const u of filtrelenmis) {
      buckets[grupBelirle(u.roller ?? [])].push(u);
    }
    return buckets;
  }, [filtrelenmis]);

  async function silKullanici(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" silinsin mi? Bu geri alınamaz.`)) return;
    try {
      await deleteUser(item.id);
      await yukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Silinemedi.");
    }
  }

  async function mfaReset(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" MFA sıfırlansın mı? Sonraki login'de yeniden setup yapacak.`)) return;
    try {
      const sonuc = await resetUserMfa(item.id);
      alert(sonuc.message);
      await yukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "MFA sıfırlanamadı.");
    }
  }

  async function sifreReset(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" için force password reset başlatılsın mı? Reset URL'i kullanıcıya ilet.`)) return;
    try {
      const sonuc = await resetUserPassword(item.id);
      prompt("Reset URL'i kopyalayıp kullanıcıya iletin:", sonuc.resetUrl);
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Şifre sıfırlanamadı.");
    }
  }

  async function rolDegistir(item: AdminUserListItem, newRole: AllowedRole) {
    if (!confirm(`"${item.email}" rolü "${newRole}" olarak değiştirilsin mi?`)) return;
    try {
      await changeUserRole(item.id, { newRole });
      await yukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Rol atanamadı.");
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="panel-baslik">
      <header className="admin-panel-ust">
        <div>
          <h2 id="panel-baslik">Kullanıcı Yönetimi</h2>
          <p className="admin-panel-aciklama">
            YEGİTEK tarafından kullanılacak. Yetkili girişi yapan herkesi buradan yönet.
            Öğrenci kayıtlarına erişim yoktur.
          </p>
        </div>
        <div className="admin-panel-aksiyonlar">
          <Link to="/admin/users/bulk" className="btn btn-ghost">
            <span aria-hidden="true">📥</span> Toplu İçe Aktar
          </Link>
          <Link to="/admin/users/new" className="btn btn-primary">
            <span aria-hidden="true">＋</span> Yeni Kullanıcı
          </Link>
        </div>
      </header>

      <div className="admin-filtre-cubugu" role="search">
        <label className="admin-filtre-alan">
          <span className="admin-filtre-etiket">Ara</span>
          <input
            type="search"
            inputMode="search"
            placeholder="Ad, e-posta, il…"
            value={searchTerm}
            onChange={(e) => filterGuncelle("q", e.target.value)}
            aria-label="Kullanıcı ara"
          />
        </label>
        <div className="admin-filtre-chipleri" role="radiogroup" aria-label="Rol filtresi">
          <button
            type="button"
            role="radio"
            aria-checked={rolFilter === ""}
            className={`chip ${rolFilter === "" ? "chip-active" : ""}`}
            onClick={() => filterGuncelle("rol", "")}
          >
            Tümü
          </button>
          {ALLOWED_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rolFilter === r}
              className={`chip ${rolFilter === r ? "chip-active" : ""}`}
              onClick={() => filterGuncelle("rol", r)}
            >
              {GRUP_BASLIKLARI[grupBelirle([r])] ?? r}
            </button>
          ))}
        </div>
        <p className="admin-filtre-sonuc" aria-live="polite">
          {calisiyor
            ? "Yükleniyor…"
            : `${filtrelenmis.length} / ${toplam} kullanıcı`}
        </p>
      </div>

      {hata && (
        <div className="admin-hata" role="alert" aria-live="assertive">
          {hata}
        </div>
      )}

      {!calisiyor && filtrelenmis.length === 0 ? (
        <div className="admin-bos-durum">
          <h3>Kullanıcı bulunamadı</h3>
          <p>
            {searchTerm || rolFilter
              ? "Filtreye uyan kullanıcı yok. Filtreyi temizleyip tekrar deneyin."
              : "Henüz hiç kullanıcı oluşturulmadı. \"Yeni Kullanıcı\" ile başlayabilirsiniz."}
          </p>
          {(searchTerm || rolFilter) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSearchParams(new URLSearchParams())}
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="admin-gruplar">
          {(Object.keys(GRUP_BASLIKLARI) as GrupKodu[]).map((kod) => {
            const kullanicilar = gruplar[kod];
            if (rolFilter && grupBelirle([rolFilter]) !== kod && kullanicilar.length === 0) {
              return null;
            }
            return (
              <GrupKarti
                key={kod}
                kod={kod}
                kullanicilar={kullanicilar}
                acik={acikGruplar[kod]}
                onToggle={(yeni) => setAcikGruplar((g) => ({ ...g, [kod]: yeni }))}
                navigate={navigate}
                onDuzenle={(u) => navigate(`/admin/users/${u.id}`)}
                onSil={silKullanici}
                onMfaReset={mfaReset}
                onSifreReset={sifreReset}
                onRolDegistir={rolDegistir}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

interface GrupKartiProps {
  kod: GrupKodu;
  kullanicilar: AdminUserListItem[];
  acik: boolean;
  onToggle: (acik: boolean) => void;
  navigate: ReturnType<typeof useNavigate>;
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
  onRolDegistir: (u: AdminUserListItem, role: AllowedRole) => void;
}

function GrupKarti({
  kod,
  kullanicilar,
  acik,
  onToggle,
  onDuzenle,
  onSil,
  onMfaReset,
  onSifreReset,
  onRolDegistir,
}: GrupKartiProps) {
  const baslikId = `grup-${kod}-baslik`;
  const govdeId = `grup-${kod}-govde`;

  return (
    <section className="admin-grup" aria-labelledby={baslikId}>
      <button
        type="button"
        className="admin-grup-baslik"
        aria-expanded={acik}
        aria-controls={govdeId}
        onClick={() => onToggle(!acik)}
      >
        <span className="admin-grup-toggle" aria-hidden="true">{acik ? "▾" : "▸"}</span>
        <span className="admin-grup-isim" id={baslikId}>
          {GRUP_BASLIKLARI[kod]}
        </span>
        <span className="admin-grup-sayi" aria-label={`${kullanicilar.length} kullanıcı`}>
          {kullanicilar.length}
        </span>
        <span className="admin-grup-aciklama">{GRUP_ACIKLAMALARI[kod]}</span>
      </button>

      {acik && (
        <div id={govdeId} className="admin-grup-govde">
          {kullanicilar.length === 0 ? (
            <p className="admin-grup-bos">Bu grupta kullanıcı yok.</p>
          ) : kod === "IlManager" || kod === "IlEvaluator" ? (
            <IlAltGruplari
              kullanicilar={kullanicilar}
              onDuzenle={onDuzenle}
              onSil={onSil}
              onMfaReset={onMfaReset}
              onSifreReset={onSifreReset}
              onRolDegistir={onRolDegistir}
            />
          ) : (
            <KullaniciListesi
              kullanicilar={kullanicilar}
              onDuzenle={onDuzenle}
              onSil={onSil}
              onMfaReset={onMfaReset}
              onSifreReset={onSifreReset}
              onRolDegistir={onRolDegistir}
            />
          )}
        </div>
      )}
    </section>
  );
}

function IlAltGruplari(props: {
  kullanicilar: AdminUserListItem[];
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
  onRolDegistir: (u: AdminUserListItem, role: AllowedRole) => void;
}) {
  // İl koduna göre grupla, alfabetik sırala.
  const iller = useMemo(() => {
    const map = new Map<number, { ilKodu: number; ilAdi: string; kullanicilar: AdminUserListItem[] }>();
    for (const u of props.kullanicilar) {
      const il = ilBul(u.roller ?? [], u.ilAtamalari ?? []);
      if (!il) continue; // il ataması olmayanları gösterme
      const mevcut = map.get(il.ilKodu);
      if (mevcut) {
        mevcut.kullanicilar.push(u);
      } else {
        map.set(il.ilKodu, { ilKodu: il.ilKodu, ilAdi: il.ilAdi, kullanicilar: [u] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ilAdi.localeCompare(b.ilAdi, "tr"));
  }, [props.kullanicilar]);

  const atamamis = props.kullanicilar.filter((u) => !ilBul(u.roller ?? [], u.ilAtamalari ?? []));

  if (iller.length === 0 && atamamis.length === 0) {
    return <p className="admin-grup-bos">Bu grupta kullanıcı yok.</p>;
  }

  return (
    <div className="admin-il-alt-gruplar">
      {iller.map((il) => (
        <details key={il.ilKodu} className="admin-il-grup" open>
          <summary>
            <span className="admin-il-adi">{il.ilAdi}</span>
            <span className="admin-il-plaka">{il.ilKodu.toString().padStart(2, "0")}</span>
            <span className="admin-il-sayi" aria-label={`${il.kullanicilar.length} kullanıcı`}>
              {il.kullanicilar.length}
            </span>
          </summary>
          <KullaniciListesi
            kullanicilar={il.kullanicilar}
            onDuzenle={props.onDuzenle}
            onSil={props.onSil}
            onMfaReset={props.onMfaReset}
            onSifreReset={props.onSifreReset}
            onRolDegistir={props.onRolDegistir}
          />
        </details>
      ))}
      {atamamis.length > 0 && (
        <details className="admin-il-grup" open>
          <summary>
            <span className="admin-il-adi">İl ataması yapılmamış</span>
            <span className="admin-il-sayi">{atamamis.length}</span>
          </summary>
          <KullaniciListesi
            kullanicilar={atamamis}
            onDuzenle={props.onDuzenle}
            onSil={props.onSil}
            onMfaReset={props.onMfaReset}
            onSifreReset={props.onSifreReset}
            onRolDegistir={props.onRolDegistir}
          />
          <p className="admin-uyari">
            Bu kullanıcıların il ataması yok. İl atamak için "Düzenle" içinde province_id gerekli.
          </p>
        </details>
      )}
    </div>
  );
}

function KullaniciListesi(props: {
  kullanicilar: AdminUserListItem[];
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
  onRolDegistir: (u: AdminUserListItem, role: AllowedRole) => void;
}) {
  return (
    <ul className="admin-kullanici-listesi" role="list">
      {props.kullanicilar.map((u) => (
        <li key={u.id} className="admin-kullanici-kart">
          <KullaniciKarti
            kullanici={u}
            onDuzenle={props.onDuzenle}
            onSil={props.onSil}
            onMfaReset={props.onMfaReset}
            onSifreReset={props.onSifreReset}
            onRolDegistir={props.onRolDegistir}
          />
        </li>
      ))}
    </ul>
  );
}

function KullaniciKarti({
  kullanici: u,
  onDuzenle,
  onSil,
  onMfaReset,
  onSifreReset,
  onRolDegistir,
}: {
  kullanici: AdminUserListItem;
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
  onRolDegistir: (u: AdminUserListItem, role: AllowedRole) => void;
}) {
  const initial = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const roller = u.roller ?? [];
  const il = ilBul(roller, u.ilAtamalari ?? []);

  return (
    <article className="admin-kart" aria-label={`${u.firstName} ${u.lastName}`}>
      <div className="admin-kart-avatar" aria-hidden="true">
        {initial}
      </div>
      <div className="admin-kart-icerik">
        <div className="admin-kart-baslik">
          <span className="admin-kart-isim">
            {u.firstName} {u.lastName}
          </span>
          <span className="admin-kart-eposta">{u.email}</span>
        </div>
        <div className="admin-kart-meta">
          {roller.map((r) => (
            <span key={r} className={`badge badge-rol badge-${r.toLowerCase()}`}>
              {r}
            </span>
          ))}
          {il && (
            <span className="badge badge-il">
              <span aria-hidden="true">📍</span> {il.ilAdi}
            </span>
          )}
          {u.twoFactorEnabled ? (
            <span className="badge badge-ok" title="İki adımlı doğrulama etkin">
              <span aria-hidden="true">🔒</span> MFA
            </span>
          ) : (
            <span className="badge badge-uyari" title="İki adımlı doğrulama kurulmamış">
              <span aria-hidden="true">⚠</span> MFA yok
            </span>
          )}
          {u.mustChangePassword && (
            <span className="badge badge-uyari">Şifre değişmeli</span>
          )}
          {u.sonGirisAt && (
            <span className="admin-kart-songiris">
              Son giriş {new Date(u.sonGirisAt).toLocaleDateString("tr-TR")}
            </span>
          )}
        </div>
      </div>
      <div className="admin-kart-aksiyonlar">
        <button type="button" className="btn-icon" onClick={() => onDuzenle(u)} aria-label={`${u.email} düzenle`}>
          <span aria-hidden="true">✎</span>
        </button>
        <button type="button" className="btn-icon" onClick={() => onMfaReset(u)} aria-label={`${u.email} MFA sıfırla`}>
          <span aria-hidden="true">🔑</span>
        </button>
        <button type="button" className="btn-icon" onClick={() => onSifreReset(u)} aria-label={`${u.email} şifre sıfırla`}>
          <span aria-hidden="true">🔗</span>
        </button>
        <select
          className="btn-icon admin-rol-select"
          value=""
          onChange={(e) => {
            const next = e.target.value as AllowedRole;
            e.target.value = "";
            if (next) onRolDegistir(u, next);
          }}
          aria-label={`${u.email} rol ata`}
        >
          <option value="">Rol ata…</option>
          {ALLOWED_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-icon btn-icon-danger"
          onClick={() => onSil(u)}
          aria-label={`${u.email} sil`}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </article>
  );
}
