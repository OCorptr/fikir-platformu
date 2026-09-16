import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { UstBar } from "./UstBar";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/giris", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <UstBar />
      <nav className="panel-nav" aria-label="Öğrenci menüsü">
        <NavLink end to="/" className={({ isActive }) => (isActive ? "aktif" : "")}>
          Ana sayfa
        </NavLink>
        <NavLink to="/profil" className={({ isActive }) => (isActive ? "aktif" : "")}>
          Profilim
        </NavLink>
        <div className="kullanici">
          <span className="harf" aria-hidden="true">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
          <span>{user?.firstName} {user?.lastName}</span>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Çıkılıyor…" : "Çıkış"}
          </button>
        </div>
      </nav>
      <main className="secim">
        <Outlet />
      </main>
    </>
  );
}
