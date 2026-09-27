// Admin Panel layout — Sprint 11.
//
// Üst başlık + sol sidebar (placeholder) + ana içerik için <Outlet />.

import { Outlet, Link, useLocation } from "react-router-dom";

export function AdminLayout() {
  const konum = useLocation();
  const baslik =
    konum.pathname === "/admin" || konum.pathname === "/admin/users"
      ? "Kullanıcı Yönetimi"
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
      </header>
      <main className="admin-panel-icerik">
        <Outlet />
      </main>
    </div>
  );
}
