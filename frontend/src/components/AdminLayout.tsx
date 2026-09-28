// AdminLayout — il/bakanlık panelleri için sidebar + üstbar çerçevesi (admin.html).
// Admin teması (assets/css/admin-panel.css) kullanılır; anasayfa ve /fikir bu temayı kullanmaz.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout, type LoginContext } from "../services/auth";
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
  const managerMi = ben?.roles.includes("ProvinceManager") ?? false;
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

  const aktifMenu = menu ?? (ministryMi ? ministryMenu : ilMenu);
  // Kenar-marka alt basligi: panel turu yerine kisinin adi yazsin.
  const baslikMetni = ben
    ? `${ben.firstName} ${ben.lastName}`
    : ilPaneli ? "İl AR-GE Paneli" : ministryMi ? "Bakanlık Paneli" : "Yönetim Paneli";

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
    const ctx: LoginContext = cikisBaglami ?? (ministryMi ? "ministry" : "province");
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
            // Sprint 11.65: `aktifYol` verilmişse tam yol yerine önek eşleşmesi
            // yapılır. /admin/users/:id açıkken "Kullanıcılar" menüsü de
            // aktif görünür (eskiden yalnızca birebir eşleşmede yanıyordu).
            const aktif = m.aktifYol
              ? yol === m.aktifYol || yol.startsWith(m.aktifYol)
              : yol === m.hedef;
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
