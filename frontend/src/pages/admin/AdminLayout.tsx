// Admin Panel layout — Sprint 11.
//
// Üst başlık + sol sidebar (placeholder) + ana içerik için <Outlet />.

import { Outlet, Link, useLocation } from "react-router-dom";

export function AdminLayout() {
  const konum = useLocation();
  const baslik =
    konum.pathname === "/admin" || konum.pathname === "/admin/users"
      ? "Kullanıcı Yönetimi"
      : konum.pathname === "/admin/raporlar"
        ? "Denetim Raporları"
        : konum.pathname.endsWith("/new")
        ? "Yeni Kullanıcı"
        : konum.pathname.includes("/sifre")
          ? "Şifre Sıfırlama"
          : "Sistem Yönetimi";

  return (
    <div className="admin-panel">
      <header className="admin-panel-baslik">
        <Link to="/" className="admin-geri">← Ana Sayfa</Link>
        <h1>{baslik}</h1>
        {/* Sprint 11.61 / YG-13,18 — yönetim ekranlarına gezinme çubuğu.
            Önceden yalnızca URL ile erişiliyordu; denetim raporlarının
            sistem yöneticisi tarafından bulunabilmesi için eklendi. */}
        <nav className="admin-menu" aria-label="Sistem yönetimi">
          <Link
            to="/admin/users"
            className={konum.pathname.startsWith("/admin/users") ? "admin-menu-aktif" : undefined}
          >
            Kullanıcılar
          </Link>
          <Link to="/admin/users/bulk">Toplu Ekleme</Link>
          <Link
            to="/admin/raporlar"
            className={konum.pathname === "/admin/raporlar" ? "admin-menu-aktif" : undefined}
          >
            Denetim Raporları
          </Link>
          <Link
            to="/admin/oauth"
            className={konum.pathname === "/admin/oauth" ? "admin-menu-aktif" : undefined}
          >
            E-posta Ayarları
          </Link>
        </nav>
      </header>
      <main className="admin-panel-icerik">
        <Outlet />
      </main>
    </div>
  );
}
