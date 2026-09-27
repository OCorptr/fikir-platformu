// Kullanıcı Yönetimi — Sprint 11.9 yeniden tasarım (compact + 81 il + default kapalı).
//
// shadcn "Dense Table" pattern + Vercel Web Interface Guidelines:
// - Compact rows: py 0.4rem, text-sm, gap 0.5rem
// - 3 grup accordion (Yönetim, İl AR-GE Yöneticileri, İl AR-GE Değerlendiricileri)
// - Default KAPALI (Onur talebi: 80 il kayıt olunca çok yer kaplıyordu)
// - localStorage v2 key (eski v1'deki default-açık state'i sıfırla)
// - İl filtre dropdown (81 il listesi header'da sticky)
// - URL search params: rol, il, q
// - Sticky grup başlığı (scroll sırasında)
// - Empty state, hata aria-live, focus-visible, klavye erişilebilir

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
  type AdminUserListItem,
  type AdminUserIlAtamasi,
} from "../../services/admin";
import { getProvinces } from "../../services/references";
import { rolAdi } from "../../services/roles";
import type { ProvinceRef } from "../../types";
import { ApiHttpError } from "../../services/api";

type GrupKodu = "Yonetim" | "IlManager" | "IlEvaluator";

const GRUP_BASLIKLARI: Record<GrupKodu, string> = {
  Yonetim: "Yönetim",
  IlManager: "İl AR-GE Yöneticileri",
  IlEvaluator: "İl AR-GE Değerlendiricileri",
};

const GRUP_ROLLERI: Record<GrupKodu, AllowedRole> = {
  Yonetim: "SystemAdmin", // grup + butonu SystemAdmin açar (Sistem Yöneticisi + Bakanlık için ortak)
  IlManager: "ProvinceManager",
  IlEvaluator: "ProvinceEvaluator",
};

const GRUP_ACIKLAMALARI: Record<GrupKodu, string> = {
  Yonetim: "Sistem yöneticileri ve bakanlık yetkilileri.",
  IlManager: "Her il için 1 yönetici.",
  IlEvaluator: "Yöneticilerin ekiplerinde değerlendiriciler.",
};

const STORAGE_KEY = "admin.acikGruplar.v2";

function grupBelirle(roller: string[]): GrupKodu {
  if (roller.includes("ProvinceManager")) return "IlManager";
  if (roller.includes("ProvinceEvaluator")) return "IlEvaluator";
  return "Yonetim"; // SystemAdmin + MinistryOfficial birlikte
}

function ilBul(
  roller: string[],
  ilAtamalari: AdminUserIlAtamasi[],
): AdminUserIlAtamasi | null {
  const whitelist = new Set(["ProvinceManager", "ProvinceEvaluator"]);
  return ilAtamalari.find((ia) => whitelist.has(ia.role)) ?? null;
}

export function UserListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rolFilter = (searchParams.get("rol") ?? "") as AllowedRole | "";
  const ilFilter = searchParams.get("il") ? Number(searchParams.get("il")) : 0;
  const searchTerm = searchParams.get("q") ?? "";

  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [toplam, setToplam] = useState(0);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(true);
  const [iller, setIller] = useState<ProvinceRef[]>([]);

  // Default KAPALI. v2 key (eski v1'deki açık state'i bypass).
  const [acikGruplar, setAcikGruplar] = useState<Record<GrupKodu, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { Yonetim: !!parsed.Yonetim, IlManager: !!parsed.IlManager, IlEvaluator: !!parsed.IlEvaluator };
      }
      // Eski key'leri temizle.
      localStorage.removeItem("admin.acikGruplar");
    } catch { /* ignore */ }
    return { Yonetim: false, IlManager: false, IlEvaluator: false };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acikGruplar));
  }, [acikGruplar]);

  useEffect(() => {
    getProvinces().then(setIller).catch(() => setIller([]));
  }, []);

  async function yukle() {
    setHata(null);
    setCalisiyor(true);
    try {
      const sonuc = await listUsers({
        sayfa: 1,
        sayfaBasina: 500,
        role: rolFilter ? (rolFilter as AllowedRole) : undefined,
        ilKodu: ilFilter > 0 ? ilFilter : undefined,
      });
      setItems(sonuc.kullanicilar);
      setToplam(sonuc.toplam);
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Kullanıcılar yüklenemedi.");
      setItems([]);
      setToplam(0);
    } finally {
      setCalisiyor(false);
    }
  }

  useEffect(() => {
    void yukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolFilter, ilFilter]);

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
      Yonetim: [], IlManager: [], IlEvaluator: [],
    };
    for (const u of filtrelenmis) {
      buckets[grupBelirle(u.roller ?? [])].push(u);
    }
    return buckets;
  }, [filtrelenmis]);

  // İl bazlı alt-gruplama (sadece manager/evaluator için).
  function ilGruplariOlustur(items: AdminUserListItem[]) {
    const map = new Map<number, { ilKodu: number; ilAdi: string; kullanicilar: AdminUserListItem[] }>();
    const atamamis: AdminUserListItem[] = [];
    for (const u of items) {
      const il = ilBul(u.roller ?? [], u.ilAtamalari ?? []);
      if (!il) { atamamis.push(u); continue; }
      const mevcut = map.get(il.ilKodu);
      if (mevcut) mevcut.kullanicilar.push(u);
      else map.set(il.ilKodu, { ilKodu: il.ilKodu, ilAdi: il.ilAdi, kullanicilar: [u] });
    }
    const sirali = Array.from(map.values()).sort((a, b) => a.ilAdi.localeCompare(b.ilAdi, "tr"));
    return { iller: sirali, atamamis };
  }

  async function silKullanici(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" silinsin mi? Bu geri alınamaz.`)) return;
    try { await deleteUser(item.id); await yukle(); }
    catch (err) { setHata(err instanceof ApiHttpError ? err.message : "Silinemedi."); }
  }

  async function mfaReset(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" MFA sıfırlansın mı?`)) return;
    try { const sonuc = await resetUserMfa(item.id); alert(sonuc.message); await yukle(); }
    catch (err) { setHata(err instanceof ApiHttpError ? err.message : "MFA sıfırlanamadı."); }
  }

  async function sifreReset(item: AdminUserListItem) {
    if (!confirm(`"${item.email}" için force password reset başlatılsın mı?`)) return;
    try { const sonuc = await resetUserPassword(item.id); prompt("Reset URL'i kopyalayıp kullanıcıya iletin:", sonuc.resetUrl); }
    catch (err) { setHata(err instanceof ApiHttpError ? err.message : "Şifre sıfırlanamadı."); }
  }

  async function rolDegistir(_item: AdminUserListItem, _newRole: AllowedRole) {
    // Sprint 11.12: "Rol Ata" akışı kaldırıldı. Rol atama artık sadece /admin/users/new
    // sayfasından yapılır. Burada bilinçli olarak no-op.
  }

  const filtreTemizle = () => setSearchParams(new URLSearchParams());

  // Her grup başlığındaki "+ Yönetici Ekle" + il alt grubundaki "+ Ekle" bu
  // handler'ı tetikler. /admin/users/new sayfasına role ve ilKodu query ile
  // yönlendirilir; UserCreatePage URL parametrelerini okuyup formu preset eder.
  function kullaniciEkleNavi(kod: GrupKodu, ilKodu?: number) {
    const params = new URLSearchParams();
    // Yönetim grubu için özel: SystemAdmin default. Bakanlık Yetkilisi ayrı
    // istenirse dropdown ile değiştirilebilir.
    const rol = GRUP_ROLLERI[kod];
    params.set("role", rol);
    if (ilKodu) params.set("ilKodu", String(ilKodu));
    navigate(`/admin/users/new?${params.toString()}`);
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-aksiyonlar admin-panel-aksiyonlar-sag">
        <Link to="/admin/users/bulk" className="btn btn-ghost">
          <span aria-hidden="true">📥</span> Toplu İçe Aktar
        </Link>
        <Link to="/admin/users/new" className="btn btn-primary">
          <span aria-hidden="true">＋</span> Yeni Kullanıcı
        </Link>
      </div>

      <div className="admin-filtre-cubugu admin-filtre-cubugu-sticky">
        <label className="admin-filtre-alan admin-filtre-arama">
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
        <label className="admin-filtre-alan admin-filtre-il">
          <span className="admin-filtre-etiket">İl</span>
          <select
            value={ilFilter > 0 ? String(ilFilter) : ""}
            onChange={(e) => filterGuncelle("il", e.target.value)}
            aria-label="İl filtresi"
          >
            <option value="">Tümü (81 il)</option>
            {iller.map((i) => (
              <option key={i.id} value={i.id}>
                {String(i.id).padStart(2, "0")} — {i.name}
              </option>
            ))}
          </select>
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
          {calisiyor ? "Yükleniyor…" : `${filtrelenmis.length} / ${toplam} kullanıcı`}
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
            {searchTerm || rolFilter || ilFilter
              ? "Filtreye uyan kullanıcı yok."
              : "Henüz kullanıcı oluşturulmadı."}
          </p>
          {(searchTerm || rolFilter || ilFilter) && (
            <button type="button" className="btn btn-ghost" onClick={filtreTemizle}>
              Filtreleri temizle
            </button>
          )}
        </div>
      ) : (
        <div className="admin-gruplar">
          {(Object.keys(GRUP_BASLIKLARI) as GrupKodu[]).map((kod) => {
            const liste = gruplar[kod];
            if (rolFilter && grupBelirle([rolFilter]) !== kod && liste.length === 0) return null;
            return (
              <GrupKarti
                key={kod}
                kod={kod}
                kullanicilar={liste}
                acik={acikGruplar[kod]}
                onToggle={(y) => setAcikGruplar((g) => ({ ...g, [kod]: y }))}
                onDuzenle={(u) => navigate(`/admin/users/${u.id}`)}
                onSil={silKullanici}
                onMfaReset={mfaReset}
                onSifreReset={sifreReset}
                onKullaniciEkle={kullaniciEkleNavi}
                ilGruplariHazirla={ilGruplariOlustur}
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
  onToggle: (y: boolean) => void;
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
  onKullaniciEkle: (kod: GrupKodu, ilKodu?: number) => void;
  ilGruplariHazirla: (items: AdminUserListItem[]) => {
    iller: { ilKodu: number; ilAdi: string; kullanicilar: AdminUserListItem[] }[];
    atamamis: AdminUserListItem[];
  };
}

function GrupKarti({
  kod, kullanicilar, acik, onToggle,
  onDuzenle, onSil, onMfaReset, onSifreReset, onKullaniciEkle,
  ilGruplariHazirla,
}: GrupKartiProps) {
  const baslikId = `grup-${kod}-baslik`;
  const govdeId = `grup-${kod}-govde`;
  const ilGruplu = kod === "IlManager" || kod === "IlEvaluator";

  return (
    <section className="admin-grup" aria-labelledby={baslikId}>
      <div className="admin-grup-baslik-satir">
        <button
          type="button"
          className="admin-grup-baslik"
          aria-expanded={acik}
          aria-controls={govdeId}
          onClick={() => onToggle(!acik)}
        >
          <span className="admin-grup-toggle" aria-hidden="true">{acik ? "▾" : "▸"}</span>
          <span className="admin-grup-isim" id={baslikId}>{GRUP_BASLIKLARI[kod]}</span>
          <span className="admin-grup-sayi" aria-label={`${kullanicilar.length} kullanıcı`}>
            {kullanicilar.length}
          </span>
          <span className="admin-grup-aciklama">{GRUP_ACIKLAMALARI[kod]}</span>
        </button>
        <button
          type="button"
          className="btn btn-primary btn-ekle"
          aria-label={`${GRUP_BASLIKLARI[kod]} grubuna yeni kullanıcı ekle`}
          onClick={(e) => {
            e.stopPropagation();
            onKullaniciEkle(kod);
          }}
        >
          <span aria-hidden="true">＋</span> Yönetici Ekle
        </button>
      </div>

      {acik && (
        <div id={govdeId} className="admin-grup-govde">
          {kullanicilar.length === 0 ? (
            <div className="admin-grup-bos">
              <p>Bu grupta henüz kullanıcı yok.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onKullaniciEkle(kod)}
              >
                <span aria-hidden="true">＋</span> İlk Kullanıcıyı Ekle
              </button>
            </div>
          ) : ilGruplu ? (
            <IlAltGruplari
              kullanicilar={kullanicilar}
              ilGruplariHazirla={ilGruplariHazirla}
              onDuzenle={onDuzenle}
              onSil={onSil}
              onMfaReset={onMfaReset}
              onSifreReset={onSifreReset}
              onKullaniciEkle={onKullaniciEkle}
              grupKodu={kod}
            />
          ) : (
            <KullaniciListesi
              kullanicilar={kullanicilar}
              onDuzenle={onDuzenle}
              onSil={onSil}
              onMfaReset={onMfaReset}
              onSifreReset={onSifreReset}
            />
          )}
        </div>
      )}
    </section>
  );
}

function IlAltGruplari({
  kullanicilar, ilGruplariHazirla,
  onDuzenle, onSil, onMfaReset, onSifreReset, onKullaniciEkle, grupKodu,
}: {
  kullanicilar: AdminUserListItem[];
  ilGruplariHazirla: GrupKartiProps["ilGruplariHazirla"];
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
  onKullaniciEkle: (kod: GrupKodu, ilKodu?: number) => void;
  grupKodu: GrupKodu;
}) {
  const { iller, atamamis } = ilGruplariHazirla(kullanicilar);
  if (iller.length === 0 && atamamis.length === 0) {
    return (
      <div className="admin-grup-bos">
        <p>Bu grupta henüz kullanıcı yok.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onKullaniciEkle(grupKodu)}
        >
          <span aria-hidden="true">＋</span> İlk Kullanıcıyı Ekle
        </button>
      </div>
    );
  }
  return (
    <div className="admin-il-alt-gruplar">
      {iller.map((il) => (
        <details key={il.ilKodu} className="admin-il-grup">
          <summary>
            <span className="admin-il-adi">{il.ilAdi}</span>
            <span className="admin-il-plaka">{String(il.ilKodu).padStart(2, "0")}</span>
            <span className="admin-il-sayi" aria-label={`${il.kullanicilar.length} kullanıcı`}>
              {il.kullanicilar.length}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-ekle-sm"
              aria-label={`${il.ilAdi} için yeni kullanıcı ekle`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onKullaniciEkle(grupKodu, il.ilKodu);
              }}
            >
              <span aria-hidden="true">＋</span> Ekle
            </button>
          </summary>
          <KullaniciListesi
            kullanicilar={il.kullanicilar}
            onDuzenle={onDuzenle}
            onSil={onSil}
            onMfaReset={onMfaReset}
            onSifreReset={onSifreReset}
          />
        </details>
      ))}
      {atamamis.length > 0 && (
        <details className="admin-il-grup" open>
          <summary>
            <span className="admin-il-adi">İl ataması yapılmamış</span>
            <span className="admin-il-sayi">{atamamis.length}</span>
            <button
              type="button"
              className="btn btn-primary btn-ekle-sm"
              aria-label="İl ataması olmadan yeni kullanıcı ekle"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onKullaniciEkle(grupKodu);
              }}
            >
              <span aria-hidden="true">＋</span> Ekle
            </button>
          </summary>
          <KullaniciListesi
            kullanicilar={atamamis}
            onDuzenle={onDuzenle}
            onSil={onSil}
            onMfaReset={onMfaReset}
            onSifreReset={onSifreReset}
          />
          <p className="admin-uyari">
            Bu kullanıcıların il ataması yok. İl atamak için "Düzenle" ile province_id gerekli.
          </p>
        </details>
      )}
    </div>
  );
}

function KullaniciListesi({
  kullanicilar, onDuzenle, onSil, onMfaReset, onSifreReset,
}: {
  kullanicilar: AdminUserListItem[];
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
}) {
  return (
    <ul className="admin-kullanici-listesi" role="list">
      {kullanicilar.map((u) => (
        <li key={u.id} className="admin-kullanici-kart">
          <KullaniciKarti
            kullanici={u}
            onDuzenle={onDuzenle}
            onSil={onSil}
            onMfaReset={onMfaReset}
            onSifreReset={onSifreReset}
          />
        </li>
      ))}
    </ul>
  );
}

function KullaniciKarti({
  kullanici: u,
  onDuzenle, onSil, onMfaReset, onSifreReset,
}: {
  kullanici: AdminUserListItem;
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
}) {
  const initial = `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const roller = u.roller ?? [];
  const il = ilBul(roller, u.ilAtamalari ?? []);

  return (
    <article className="admin-kart admin-kart-compact" aria-label={`${u.firstName} ${u.lastName}`}>
      <div className="admin-kart-avatar admin-kart-avatar-sm" aria-hidden="true">
        {initial}
      </div>
      <div className="admin-kart-icerik">
        <div className="admin-kart-baslik">
          <span className="admin-kart-isim">
            {u.firstName} {u.lastName}
          </span>
          <span className="admin-kart-eposta">{u.email}</span>
          {il && (
            <span className="badge badge-il">
              <span aria-hidden="true">📍</span> {il.ilAdi}
            </span>
          )}
        </div>
        <div className="admin-kart-meta">
          {roller.map((r) => (
            <span key={r} className={`badge badge-rol badge-${r.toLowerCase()}`}>
              {rolAdi(r)}
            </span>
          ))}
          {u.twoFactorEnabled ? (
            <span className="badge badge-ok" title="MFA etkin">MFA ✓</span>
          ) : (
            <span className="badge badge-uyari" title="MFA kurulmamış">MFA yok</span>
          )}
          {u.mustChangePassword && <span className="badge badge-uyari">Şifre değişmeli</span>}
          {u.sonGirisAt && (
            <span className="admin-kart-songiris">
              Son giriş {new Date(u.sonGirisAt).toLocaleDateString("tr-TR")}
            </span>
          )}
        </div>
      </div>
      <div className="admin-kart-aksiyonlar">
        <button type="button" className="btn-icon" onClick={() => onDuzenle(u)} aria-label={`${u.email} düzenle`} title="Düzenle">
          <span aria-hidden="true">✎</span>
        </button>
        <button type="button" className="btn-icon" onClick={() => onMfaReset(u)} aria-label={`${u.email} MFA sıfırla`} title="MFA sıfırla">
          <span aria-hidden="true">🔑</span>
        </button>
        <button type="button" className="btn-icon" onClick={() => onSifreReset(u)} aria-label={`${u.email} şifre sıfırla`} title="Şifre sıfırla">
          <span aria-hidden="true">🔗</span>
        </button>
        <button
          type="button"
          className="btn-icon btn-icon-danger"
          onClick={() => onSil(u)}
          aria-label={`${u.email} sil`}
          title="Sil"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </article>
  );
}
