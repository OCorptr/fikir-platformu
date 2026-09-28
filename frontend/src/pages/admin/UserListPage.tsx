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
import { UserCreateModal } from "./UserCreateModal";

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

  // Sprint 11.49: Drawer modal state
  const [ekleAcik, setEkleAcik] = useState(false);
  const [ekleGrup, setEkleGrup] = useState<"Yonetim" | "IlManager" | "IlEvaluator">("Yonetim");
  const [ekleIlKodu, setEkleIlKodu] = useState<number | undefined>();
  const ekleIlAdi = useMemo(() => {
    if (ekleIlKodu == null) return undefined;
    return iller.find((i) => i.id === ekleIlKodu)?.name;
  }, [ekleIlKodu, iller]);

  function acEkleModal(grup: "Yonetim" | "IlManager" | "IlEvaluator", il?: number) {
    setEkleGrup(grup);
    setEkleIlKodu(il);
    setEkleAcik(true);
  }

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
    if (!confirm(`"${item.email}" için force password reset başlatılsın mı? Sıfırlama bağlantısı kullanıcının e-postasına gönderilecek.`)) return;
    try {
      const sonuc = await resetUserPassword(item.id);
      // Sprint 11.13: Backend artık otomatik mail atıyor. URL'i prompt ile
      // göstermek yerine kullanıcıya bilgi ver. Mail gönderilemediyse fallback
      // olarak resetUrl response'da gelir (bu durumda admin linki başka yöntemle
      // iletebilir).
      if (sonuc.resetUrl) {
        await navigator.clipboard.writeText(sonuc.resetUrl);
        alert(`${sonuc.message}\n\nMail gönderilemediği için link panoya kopyalandı — kullanıcıya başka bir yöntemle iletin.`);
      } else {
        alert(sonuc.message);
      }
      await yukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Şifre sıfırlanamadı.");
    }
  }

  async function rolDegistir(_item: AdminUserListItem, _newRole: AllowedRole) {
    // Sprint 11.12: "Rol Ata" akışı kaldırıldı. Rol atama artık sadece /admin/users/new
    // sayfasından yapılır. Burada bilinçli olarak no-op.
  }

  const filtreTemizle = () => setSearchParams(new URLSearchParams());

  // Her grup başlığındaki "+ Yönetici Ekle" + il alt grubundaki "+ Ekle" bu
  // handler'ı tetikler. Sprint 11.49: Drawer modal açılır (route navigation yok).
  function kullaniciEkleNavi(kod: GrupKodu, ilKodu?: number) {
    acEkleModal(kod, ilKodu);
  }

  return (
    <div className="adm-sayfa">
      <div className="adm-satir-ara" style={{ marginBottom: "1rem" }}>
        <p className="adm-aciklama" style={{ margin: 0 }}>
          Sistem yöneticileri, bakanlık yetkilileri ve il AR-GE personeli.
        </p>
        <Link to="/admin/users/bulk" className="adm-btn">
          Toplu İçe Aktar
        </Link>
      </div>

      <div className="adm-filtre-cubugu">
        <label className="adm-alan">
          <span className="adm-etiket">Ara</span>
          <input
            className="adm-input"
            type="search"
            name="q"
            inputMode="search"
            placeholder="Ad, e-posta veya il…"
            value={searchTerm}
            onChange={(e) => filterGuncelle("q", e.target.value)}
          />
        </label>
        <label className="adm-alan">
          <span className="adm-etiket">İl</span>
          <select
            className="adm-input"
            name="il"
            value={ilFilter > 0 ? String(ilFilter) : ""}
            onChange={(e) => filterGuncelle("il", e.target.value)}
          >
            <option value="">Tümü (81 il)</option>
            {iller.map((i) => (
              <option key={i.id} value={i.id}>
                {String(i.id).padStart(2, "0")} — {i.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="adm-alan" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="adm-etiket">Rol</legend>
          <div className="adm-cip-grup" role="radiogroup" aria-label="Rol filtresi">
            <button
              type="button"
              role="radio"
              aria-checked={rolFilter === ""}
              className={
                rolFilter === "" ? "adm-cip adm-cip-aktif" : "adm-cip"
              }
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
                className={
                  rolFilter === r ? "adm-cip adm-cip-aktif" : "adm-cip"
                }
                onClick={() => filterGuncelle("rol", r)}
              >
                {GRUP_BASLIKLARI[grupBelirle([r])] ?? r}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="adm-meta" aria-live="polite" style={{ margin: 0 }}>
          {calisiyor
            ? "Yükleniyor…"
            : `${filtrelenmis.length} / ${toplam} kullanıcı`}
        </p>
      </div>

      {hata && (
        <div className="adm-bildirim adm-bildirim-hata" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{hata}</span>
        </div>
      )}

      {!calisiyor && filtrelenmis.length === 0 ? (
        <div className="adm-bos-durum">
          <h3 className="adm-h2" style={{ marginTop: 0 }}>
            Kullanıcı bulunamadı
          </h3>
          <p>
            {searchTerm || rolFilter || ilFilter
              ? "Seçtiğiniz filtreye uyan kullanıcı yok."
              : "Henüz kullanıcı oluşturulmadı."}
          </p>
          {(searchTerm || rolFilter || ilFilter) && (
            <button
              type="button"
              className="adm-btn"
              onClick={filtreTemizle}
              style={{ marginTop: "0.6rem" }}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      ) : (
        /* Sprint 11.65 — dar ekranda tablo yatay kaydırma kutusuna alınır
           (admin-theme.css @media max-width:900px). Sütunları gizlemiyoruz:
           sistem yöneticisi karşılaştırma için hepsine ihtiyaç duyuyor. */
        <div className="adm-yigin">
          {(Object.keys(GRUP_BASLIKLARI) as GrupKodu[]).map((kod) => {
            const liste = gruplar[kod];
            if (rolFilter && grupBelirle([rolFilter]) !== kod && liste.length === 0)
              return null;
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

      <UserCreateModal
        acik={ekleAcik}
        onClose={() => setEkleAcik(false)}
        grupKodu={ekleGrup}
        ilKodu={ekleIlKodu}
        ilAdi={ekleIlAdi}
        basariliCallback={() => { void yukle(); }}
      />
    </div>
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
    <section className="adm-kart" aria-labelledby={baslikId}>
      <div className="adm-grup-ust">
        <button
          type="button"
          className="adm-grup-baslik"
          aria-expanded={acik}
          aria-controls={govdeId}
          onClick={() => onToggle(!acik)}
        >
          <span className="adm-grup-ok" aria-hidden="true">
            {acik ? "▾" : "▸"}
          </span>
          <span className="adm-grup-ad" id={baslikId}>
            {GRUP_BASLIKLARI[kod]}
          </span>
          <span
            className="adm-rozet adm-rozet-mavi adm-rozet-sayi"
            aria-label={`${kullanicilar.length} kullanıcı`}
          >
            {kullanicilar.length}
          </span>
          <span className="adm-meta">{GRUP_ACIKLAMALARI[kod]}</span>
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-ana"
          aria-label={`${GRUP_BASLIKLARI[kod]} grubuna yeni kullanıcı ekle`}
          onClick={() => onKullaniciEkle(kod)}
        >
          Yönetici Ekle
        </button>
      </div>

      {acik && (
        <div id={govdeId} style={{ marginTop: "0.9rem" }}>
          {kullanicilar.length === 0 ? (
            <div className="adm-bos-durum">
              <p style={{ margin: 0 }}>Bu grupta henüz kullanıcı yok.</p>
              <button
                type="button"
                className="adm-btn adm-btn-ana"
                onClick={() => onKullaniciEkle(kod)}
                style={{ marginTop: "0.6rem" }}
              >
                İlk Kullanıcıyı Ekle
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
      <div className="adm-bos-durum">
        <p style={{ margin: 0 }}>Bu grupta henüz kullanıcı yok.</p>
        <button
          type="button"
          className="adm-btn adm-btn-ana"
          onClick={() => onKullaniciEkle(grupKodu)}
          style={{ marginTop: "0.6rem" }}
        >
          İlk Kullanıcıyı Ekle
        </button>
      </div>
    );
  }
  return (
    <div className="adm-yigin">
      {iller.map((il) => (
        <details key={il.ilKodu} className="adm-kart" style={{ marginBottom: 0 }}>
          <summary className="adm-grup-baslik" style={{ listStyle: "none" }}>
            <span className="adm-grup-ok" aria-hidden="true">
              ▸
            </span>
            <span className="adm-grup-ad">{il.ilAdi}</span>
            <span className="adm-rozet adm-rozet-sayi" aria-label={`${il.ilKodu} plaka kodu`}>
              {String(il.ilKodu).padStart(2, "0")}
            </span>
            <span
              className="adm-rozet adm-rozet-mavi"
              aria-label={`${il.kullanicilar.length} kullanıcı`}
            >
              {il.kullanicilar.length}
            </span>
          </summary>
          <div style={{ marginTop: "0.75rem" }}>
            <KullaniciListesi
              kullanicilar={il.kullanicilar}
              onDuzenle={onDuzenle}
              onSil={onSil}
              onMfaReset={onMfaReset}
              onSifreReset={onSifreReset}
            />
            <button
              type="button"
              className="adm-btn"
              style={{ marginTop: "0.6rem" }}
              aria-label={`${il.ilAdi} için yeni kullanıcı ekle`}
              onClick={() => onKullaniciEkle(grupKodu, il.ilKodu)}
            >
              Bu ile kullanıcı ekle
            </button>
          </div>
        </details>
      ))}
      {atamamis.length > 0 && (
        <details className="adm-kart" open style={{ marginBottom: 0 }}>
          <summary className="adm-grup-baslik" style={{ listStyle: "none" }}>
            <span className="adm-grup-ok" aria-hidden="true">
              ▾
            </span>
            <span className="adm-grup-ad">İl ataması yapılmamış</span>
            <span className="adm-rozet adm-rozet-sari">{atamamis.length}</span>
          </summary>
          <div style={{ marginTop: "0.75rem" }}>
            <div className="adm-bildirim adm-bildirim-uyari" role="status">
              <span aria-hidden="true">ℹ</span>
              <span>
                Bu kullanıcıların il ataması yok. İl atamak için
                &quot;Düzenle&quot; ile il bilgisini girin.
              </span>
            </div>
            <KullaniciListesi
              kullanicilar={atamamis}
              onDuzenle={onDuzenle}
              onSil={onSil}
              onMfaReset={onMfaReset}
              onSifreReset={onSifreReset}
            />
            <button
              type="button"
              className="adm-btn"
              style={{ marginTop: "0.6rem" }}
              onClick={() => onKullaniciEkle(grupKodu)}
            >
              Bu gruba kullanıcı ekle
            </button>
          </div>
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
  if (kullanicilar.length === 0) {
    return null;
  }

  return (
    <div className="adm-tablo-kaydir">
    <table className="adm-tablo">
      <caption className="sr-only">
        Kullanıcı listesi — düzenle, MFA sıfırla, şifre sıfırla ve sil işlemleri
        için satır sonundaki düğmeleri kullanın.
      </caption>
      <thead>
        <tr>
          <th scope="col">Ad Soyad</th>
          <th scope="col">E-posta</th>
          <th scope="col">İl</th>
          <th scope="col">Rol</th>
          <th scope="col">Güvenlik</th>
          <th scope="col">Son Giriş</th>
          <th scope="col">İşlemler</th>
        </tr>
      </thead>
      <tbody>
        {kullanicilar.map((u) => (
          <KullaniciSatiri
            key={u.id}
            kullanici={u}
            onDuzenle={onDuzenle}
            onSil={onSil}
            onMfaReset={onMfaReset}
            onSifreReset={onSifreReset}
          />
        ))}
      </tbody>
    </table>
    </div>
  );
}

function KullaniciSatiri({
  kullanici: u,
  onDuzenle, onSil, onMfaReset, onSifreReset,
}: {
  kullanici: AdminUserListItem;
  onDuzenle: (u: AdminUserListItem) => void;
  onSil: (u: AdminUserListItem) => void;
  onMfaReset: (u: AdminUserListItem) => void;
  onSifreReset: (u: AdminUserListItem) => void;
}) {
  const roller = u.roller ?? [];
  const il = ilBul(roller, u.ilAtamalari ?? []);

  return (
    <tr>
      <th scope="row" style={{ fontWeight: 700, color: "var(--yt-lacivert)" }}>
        {u.firstName} {u.lastName}
      </th>
      <td>
        <span style={{ overflowWrap: "anywhere" }}>{u.email}</span>
      </td>
      <td>{il ? il.ilAdi : <span className="adm-meta">—</span>}</td>
      <td>
        <span className="adm-rozet-grup">
          {roller.length === 0 ? (
            <span className="adm-meta">rol yok</span>
          ) : (
            roller.map((r) => (
              <span key={r} className="adm-rozet adm-rozet-mavi">
                {rolAdi(r)}
              </span>
            ))
          )}
        </span>
      </td>
      <td>
        <span className="adm-rozet-grup">
          {u.twoFactorEnabled ? (
            <span className="adm-rozet adm-rozet-yesil">MFA etkin</span>
          ) : (
            <span className="adm-rozet adm-rozet-sari">MFA yok</span>
          )}
          {u.mustChangePassword && (
            <span className="adm-rozet adm-rozet-sari">Şifre değişmeli</span>
          )}
        </span>
      </td>
      <td className="adm-tablo-sayisal">
        {u.sonGirisAt
          ? new Date(u.sonGirisAt).toLocaleDateString("tr-TR")
          : "—"}
      </td>
      <td>
        <span className="adm-islem-grup">
          <button
            type="button"
            className="adm-btn"
            onClick={() => onDuzenle(u)}
            aria-label={`${u.email} — düzenle`}
          >
            Düzenle
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={() => onMfaReset(u)}
            aria-label={`${u.email} — MFA sıfırla`}
          >
            MFA
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={() => onSifreReset(u)}
            aria-label={`${u.email} — şifre sıfırlama bağlantısı gönder`}
          >
            Şifre
          </button>
          <button
            type="button"
            className="adm-btn adm-btn-tehlike"
            onClick={() => onSil(u)}
            aria-label={`${u.email} — kullanıcıyı sil`}
          >
            Sil
          </button>
        </span>
      </td>
    </tr>
  );
}
