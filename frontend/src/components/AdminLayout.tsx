// AdminLayout — il/bakanlık panelleri için sidebar + üstbar çerçevesi (admin.html).
// Admin teması (assets/css/admin-panel.css) kullanılır; anasayfa ve /fikir bu temayı kullanmaz.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout, type LoginContext } from "../services/auth";
import { ilYoneticiMi } from "./YetkiliPanelSecim";
import { rolAdi } from "../services/roles";
import type { MeSession } from "../types";

interface AdminLayoutProps {
  ben: MeSession | null;
  baslik: string;
  aciklama?: string;
  donemRozet?: string;       // sağ üst dönem rozeti (opsiyonel)
  children: ReactNode;
  /**
   * Sprint 11.65 — Sol kenar paneli menüsü. Verilmezse rol bazlı varsayılan
   * kullanılır (il paneli / bakanlık). /admin paneli kendi menüsünü geçer.
   * Böylece TÜM paneller aynı kenar panelini, aynı çıkış yolunu paylaşır.
   */
  menu?: PanelMenuItem[];
  /** Sprint 11.65 — çıkışta hangi oturumun kapatılacağı. Varsayılan: role bakılır. */
  cikisBaglami?: LoginContext;
}

export interface PanelMenuItem {
  hedef: string;             // path
  baslik: string;             // .km-yazi
  svg: ReactNode;
  rozet?: { deger: string | number; renk?: "mavi" };
  /** Bu öğenin aktif sayılması için eşleşecek yol kalıbı (tam yol yerine). */
  aktifYol?: string;
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ikon = {
  gelen: (
    <svg {...svgProps}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z" />
    </svg>
  ),
  aday: (
    <svg {...svgProps}>
      <path d="M12 3v18" />
      <path d="M5 7l-3 6a3.5 3.5 0 0 0 6 0L5 7z" />
      <path d="M19 7l-3 6a3.5 3.5 0 0 0 6 0l-3-6z" />
      <path d="M7 21h10" />
    </svg>
  ),
  donem: (
    <svg {...svgProps}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  ),
  rapor: (
    <svg {...svgProps}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 5-5" />
    </svg>
  ),
  // Sprint 11.65 — sistem yönetimi menüsü ikonları.
  kullanici: (
    <svg {...svgProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  yukle: (
    <svg {...svgProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  kilit: (
    <svg {...svgProps}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  ePosta: (
    <svg {...svgProps}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
};

export const panelIkon = ikon;

/** Menü öğesini benzersiz tanımlayan anahtar (aktiflik karşılaştırması için). */
function menuKimligi(m: PanelMenuItem): string {
  return m.hedef;
}

/** Bir öğenin verilen yolla eşleşip eşleşmediği (birebir ya da önek). */
function eslesiyorMu(yol: string, oge: PanelMenuItem): boolean {
  if (oge.aktifYol) return yol === oge.hedef || yol === oge.aktifYol || yol.startsWith(`${oge.aktifYol}/`);
  return yol === oge.hedef || yol.startsWith(`${oge.hedef}/`);
}

/**
 * Sprint 11.66 — aktif menü öğesini belirler.
 *
 * Birden fazla öğe önek olarak eşleşebilir (`/admin/users` ve
 * `/admin/users/bulk`, yol `/admin/users/bulk` ikisine de uyar). En UZUN
 * eşleşme kazanır; hiçbiri eşleşmezse boş dönüş. Böylece aynı anda iki öğe
 * birden vurgulanmaz.
 */
function aktifHedef(yol: string, menu: PanelMenuItem[]): string {
  let kazanan = "";
  let kazananUzunluk = -1;
  for (const oge of menu) {
    if (!eslesiyorMu(yol, oge)) continue;
    const olasi = oge.aktifYol ?? oge.hedef;
    if (olasi.length > kazananUzunluk) {
      kazananUzunluk = olasi.length;
      kazanan = menuKimligi(oge);
    }
  }
  return kazanan;
}

export function AdminLayout({
  ben, baslik, aciklama, donemRozet, children, menu, cikisBaglami,
}: AdminLayoutProps) {
  const navigate = useNavigate();
  const yol = useLocation().pathname;
  const [kullaniciMenuAcik, setKullaniciMenuAcik] = useState(false);
  const kullaniciMenuRef = useRef<HTMLDivElement>(null);

  // body class'ı admin sayfalarında "sayfa-admin" olmalı (admin.css govde kenarı buna göre konumlandırır)
  useEffect(() => {
    document.body.classList.add("sayfa-admin");
    return () => {
      // rota değişince /fikir veya /'a dönülürse govde kenar boşluğu kalkmalı
      // (sayfa değişimi App.tsx'teki GovdeSinifi ile düzenleniyor; cleanup orada)
    };
  }, []);

  // Kullanıcı menüsünü dışarı tıklayınca kapat (plan §3.4 — üst bar dropdown).
  useEffect(() => {
    if (!kullaniciMenuAcik) return;
    function tikla(e: MouseEvent) {
      if (kullaniciMenuRef.current && !kullaniciMenuRef.current.contains(e.target as Node)) {
        setKullaniciMenuAcik(false);
      }
    }
    document.addEventListener("mousedown", tikla);
    return () => document.removeEventListener("mousedown", tikla);
  }, [kullaniciMenuAcik]);

  // Rol bazlı menü
  const ilPaneli = ben?.roles.some((r) => r === "ProvinceEvaluator" || r === "ProvinceManager") ?? false;
  // Onur (S11.79): sistem yöneticisi istisnadır (kurum kuralı: "Sistem
  // Yöneticisi dışında kimsede birden fazla panele erişemez"), il AR-GE yönetim
  // işlerini de yapar. İl ataması kendisinde olmadığı için Ekip/Aday Havuzu
  // menüden gizleniyordu, oysa sayfalar ona açık (Ekip sayfasında il seçici var).
  const managerMi = ben ? ilYoneticiMi(ben.roles) : false;
  const ministryMi = ben?.roles.includes("MinistryOfficial") ?? false;

  const ilMenu: PanelMenuItem[] = [
    { hedef: "/il-panel", baslik: "Gelen Fikirler", svg: ikon.gelen },
    { hedef: "/il-panel/rapor", baslik: "Raporlama", svg: ikon.rapor },
    ...(managerMi ? [{ hedef: "/il-panel/adaylar", baslik: "Aday Havuzu", svg: ikon.aday } as PanelMenuItem] : []),
    ...(managerMi ? [{ hedef: "/il-panel/ekip", baslik: "Ekip", svg: ikon.aday } as PanelMenuItem] : []),
  ];

  const ministryMenu: PanelMenuItem[] = [
    { hedef: "/bakanlik", baslik: "Aktif Adaylar", svg: ikon.aday },
    { hedef: "/bakanlik/donemler", baslik: "Dönemler", svg: ikon.donem },
  ];

  // Onur (S11.79): Menü ve çıkış bağlamı ROLE göre değil PANELE göre belirlenir.
  //
  // "il-panel kısmına girince soldaki panelde Aktif Adaylar, Dönemler var,
  //  tıkladığımda bakanlığa yönlendiriyor, ne alaka il-panel'da neden onlar var?"
  //
  // Sebep: `ministryMi` kontrolü role bakıyordu. Sistem yöneticisinin
  // rollerinde MinistryOfficial da olduğu için /il-panel içinde bile
  // ministryMenu çiziliyordu. Menü, içinde bulunulan panelin menüsüdür —
  // kim olursan ol o panelin menüsü görünür.
  const aktifPanel: "admin" | "ministry" | "province" = yol.startsWith("/admin")
    ? "admin"
    : yol.startsWith("/bakanlik")
      ? "ministry"
      : "province";

  const aktifMenu = menu ?? (aktifPanel === "ministry" ? ministryMenu : ilMenu);
  const aktifOge = aktifHedef(yol, aktifMenu);
  // Kenar-marka alt basligi: panel turu yerine kisinin adi yazsin.
  const baslikMetni = ben
    ? `${ben.firstName} ${ben.lastName}`
    : aktifPanel === "ministry" ? "Bakanlık Paneli" : aktifPanel === "admin" ? "Yönetim Paneli" : "İl AR-GE Paneli";

  const kullaniciAdi = ben ? `${ben.firstName} ${ben.lastName}` : "Kullanıcı";
  const kullaniciBen = kullaniciAdi;
  // Sprint 11.10 — Rol etiketleri. Identity DB adı korunur (MinistryOfficial vb.),
  // UI gösterimi services/roles.ts'deki ROLE_DISPLAY ile çevrilir (ArgeMinistry vb.).
  const rolEtiket = ben?.roles.map(rolAdi).join(" · ") ?? "";
  const avatarBasHarf = kullaniciAdi
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toLocaleUpperCase("tr-TR"))
    .join("") || "?";

  async function cikis() {
    // Onur (S11.79): Aynı hata çıkışta da vardı — /il-panel'da "Çıkış yap"
    // ministry oturumunu kapatıyordu, panelde kalıyordun. Bağlam pane ile
    // belirlenir. /admin'de context yok → backend üç şemanın da çıkışını yapar
    // (yönetici panosundan çıkış tüm oturumları kapatmalı).
    const ctx: LoginContext | undefined =
      cikisBaglami ?? (aktifPanel === "admin" ? undefined : aktifPanel === "ministry" ? "ministry" : "province");
    try {
      await logout(ctx);
    } catch { /* yoksay */ }
    // Çıkış başarılı → anasayfaya yönlendir. replace:true ki geri tuşu admin'e dönmesin.
    navigate("/", { replace: true });
  }

  return (
    <>
      <aside className="kenar">
        <div className="kenar-marka">
          <img src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE" />
          <div>
            <b>GELECEĞİN FİKRİ</b>
            <small>{baslikMetni}</small>
          </div>
        </div>
        <nav className="kenar-menu">
          {aktifMenu.map((m) => {
            // Sprint 11.66 (Onur): "sol taraftaki dikey panelde sadece seçili
            // olan sarı renk olması lazım ama bazılarında başka seçim yapsan
            // da aktif olmayan kısım yine sarı renkli kalıyor. Örnek
            // Kullanıcılar."
            //
            // Sebep: her öğe kendi eşleşmesini ayrı hesaplıyordu. `/admin/users`
            // öneki `/admin/users/bulk` yolunda da eşleştiği için hem
            // "Kullanıcılar" hem "Toplu Ekleme" aynı anda sarı kalıyordu.
            //
            // Düzeltme: aktif olan EN UZUN eşleşen yol belirleyicidir. Alt
            // öğe kazanırsa üst öğe pasif kalır.
            const aktif = aktifOge === menuKimligi(m);
            return (
              <Link
                key={m.hedef}
                to={m.hedef}
                className={`km-oge ${aktif ? "aktif" : ""}`}
                aria-current={aktif ? "page" : undefined}
              >
                {m.svg}
                <span className="km-yazi">{m.baslik}</span>
                {m.rozet && <span className={`rozet ${m.rozet.renk ?? ""}`}>{m.rozet.deger}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="kenar-alt">
          <div className="kullanici-kutu">
            <span className="k-avatar">{avatarBasHarf}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{kullaniciAdi}</b>
              <small style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#9FB4CC", fontWeight: 700, fontSize: "0.75rem" }}>{rolEtiket}</small>
            </div>
          </div>
          <button type="button" className="btn-ikincil" onClick={cikis} style={{ marginTop: "0.6rem", width: "100%", justifyContent: "center" }}>
            🚪 Çıkış Yap
          </button>
        </div>
      </aside>

      <div className="govde">
        <header className="ustbar">
          <div>
            <h1>{baslik}</h1>
            {aciklama && <p>{aciklama}</p>}
          </div>
          {donemRozet && <span className="donem-rozeti">{donemRozet}</span>}
        </header>
        <main className="icerik">{children}</main>
      </div>
    </>
  );
}
