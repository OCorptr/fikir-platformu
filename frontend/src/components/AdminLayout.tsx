// AdminLayout — il/bakanlık panelleri için sidebar + üstbar çerçevesi (admin.html).
// Admin teması (assets/css/admin-panel.css) kullanılır; anasayfa ve /fikir bu temayı kullanmaz.

import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout, type LoginContext } from "../services/auth";
import type { MeSession } from "../types";

interface AdminLayoutProps {
  ben: MeSession | null;
  baslik: string;
  aciklama?: string;
  donemRozet?: string;       // sağ üst dönem rozeti (opsiyonel)
  children: ReactNode;
}

interface MenuItem {
  hedef: string;             // path
  baslik: string;             // .km-yazi
  svg: ReactNode;
  rozet?: { deger: string | number; renk?: "mavi" };
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
  uygulama: (
    <svg {...svgProps}>
      <path d="M5 20V10" /><path d="M12 20V4" /><path d="M19 20v-7" /><path d="M3 20h18" />
    </svg>
  ),
  ev: (
    <svg {...svgProps}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
};

export function AdminLayout({ ben, baslik, aciklama, donemRozet, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const yol = useLocation().pathname;

  // body class'ı admin sayfalarında "sayfa-admin" olmalı (admin.css govde kenarı buna göre konumlandırır)
  useEffect(() => {
    document.body.classList.add("sayfa-admin");
    return () => {
      // rota değişince /fikir veya /'a dönülürse govde kenar boşluğu kalkmalı
      // (sayfa değişimi App.tsx'teki GovdeSinifi ile düzenleniyor; cleanup orada)
    };
  }, []);

  // Rol bazlı menü
  const ilPaneli = ben?.roles.some((r) => r === "ProvinceEvaluator" || r === "ProvinceManager") ?? false;
  const managerMi = ben?.roles.includes("ProvinceManager") ?? false;
  const ministryMi = ben?.roles.includes("MinistryOfficial") ?? false;

  const ilMenu: MenuItem[] = [
    { hedef: "/il-panel", baslik: "Gelen Fikirler", svg: ikon.gelen },
    ...(managerMi ? [{ hedef: "/il-panel/adaylar", baslik: "Aday Havuzu", svg: ikon.aday } as MenuItem] : []),
  ];

  const ministryMenu: MenuItem[] = [
    { hedef: "/bakanlik", baslik: "Dönemler & Adaylar", svg: ikon.donem },
    { hedef: "/bakanlik/uygulamalar", baslik: "Uygulama Takibi", svg: ikon.uygulama },
  ];

  const aktifMenu = ministryMi ? ministryMenu : ilMenu;
  const baslikMetni = ilPaneli ? "İl Ar-Ge Paneli" : ministryMi ? "Bakanlık Paneli" : "Yönetim Paneli";

  const kullaniciAdi = ben ? `${ben.firstName} ${ben.lastName}` : "Kullanıcı";
  const rolAdi = ben?.roles.join(" · ") ?? "";
  const avatarBasHarf = kullaniciAdi
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toLocaleUpperCase("tr-TR"))
    .join("") || "?";

  async function cikis() {
    const ctx: LoginContext = ministryMi ? "ministry" : "province";
    try {
      await logout(ctx);
    } catch { /* yoksay */ }
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
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
            const aktif = yol === m.hedef || (m.hedef !== "/" && yol.startsWith(m.hedef + "/")) || (m.hedef === "/bakanlik" && yol === "/bakanlik");
            return (
              <button
                key={m.hedef}
                type="button"
                className={`km-oge ${aktif ? "aktif" : ""}`}
                onClick={() => {
                  window.history.pushState({}, "", m.hedef);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                {m.svg}
                <span className="km-yazi">{m.baslik}</span>
                {m.rozet && <span className={`rozet ${m.rozet.renk ?? ""}`}>{m.rozet.deger}</span>}
              </button>
            );
          })}
        </nav>
        <div className="kenar-alt">
          <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
            {ikon.ev}
            <span className="km-yazi">Ana Sayfa</span>
          </a>
          <div className="kullanici-kutu">
            <span className="k-avatar">{avatarBasHarf}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{kullaniciAdi}</b>
              <small style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rolAdi}</small>
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
          <div className="ustbar-sag">
            {donemRozet && <span className="donem-rozeti">{donemRozet}</span>}
          </div>
        </header>
        <main className="icerik">{children}</main>
      </div>
    </>
  );
}
