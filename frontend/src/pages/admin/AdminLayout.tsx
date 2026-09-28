// Admin Panel düzeni — Sprint 11 / Sprint 11.64 (yeniden tasarım).
//
// Görsel dil İl AR-GE / Bakanlık panellerinden alındı. Referans
// (`styles.css` → "İl AR-GE Paneli") DEĞİŞTİRİLMEDİ; burada yalnızca
// admin kapsamı için sakin bir türev kullanılıyor (bkz. admin-theme.css).
//
// Erişilebilirlik:
//   - Aktif menü öğesi `aria-current="page"` ile işaretlenir (eskiden yalnızca
//     bir CSS sınıfı ile renk değişiyordu — ekran okuyucu durumu bildirmiyordu).
//   - Menü <nav> + aria-label taşır.
//   - Atlama bağlantısı: içeriğe odaklanmak için "İçeriğe geç" bağlantısı.
//   - Sayfa başlığı <h1>, her rota kendi başlığını getirir (tek H1 kuralı).

import { Link, Outlet, useLocation } from "react-router-dom";

const MENU = [
  { yol: "/admin/users", etiket: "Kullanıcılar" },
  { yol: "/admin/users/bulk", etiket: "Toplu Ekleme" },
  { yol: "/admin/raporlar", etiket: "Denetim Raporları" },
  { yol: "/admin/oauth", etiket: "E-posta Ayarları" },
] as const;

function baslikBul(yol: string): string {
  if (yol === "/admin" || yol === "/admin/users") return "Kullanıcı Yönetimi";
  if (yol === "/admin/users/bulk") return "Toplu Kullanıcı Ekleme";
  if (yol === "/admin/raporlar") return "Denetim Raporları";
  if (yol === "/admin/oauth") return "E-posta Ayarları";
  if (yol.endsWith("/new")) return "Yeni Kullanıcı";
  if (yol.includes("/sifre")) return "Şifre Sıfırlama";
  return "Sistem Yönetimi";
}

/** /admin/users/:id düzeni — liste menüsü de aktif sayılır ama başlık ayrı. */
function menuAktifMi(aktifYol: string, hedef: string): boolean {
  if (hedef === "/admin/users") {
    return aktifYol === "/admin/users" || /^\/admin\/users\/[^/]+$/.test(aktifYol);
  }
  return aktifYol === hedef;
}

export function AdminLayout() {
  const konum = useLocation();
  const baslik = baslikBul(konum.pathname);

  return (
    <div className="adm-panel">
      <header className="adm-panel-ust">
        <div>
          <Link to="/" className="adm-geri">
            ← Ana Sayfa
          </Link>
          <h1 className="adm-ust-baslik">{baslik}</h1>
          <nav className="adm-menu" aria-label="Sistem yönetimi">
            {MENU.map((m) => (
              <Link
                key={m.yol}
                to={m.yol}
                aria-current={menuAktifMi(konum.pathname, m.yol) ? "page" : undefined}
              >
                {m.etiket}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <a href="#adm-icerik" className="sr-only">
        İçeriğe geç
      </a>

      <main id="adm-icerik" className="adm-sayfa">
        <Outlet />
      </main>
    </div>
  );
}
