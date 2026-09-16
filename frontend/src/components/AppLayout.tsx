import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "./Brand";

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
    <div className="portal-shell">
      <header className="portal-header">
        <Brand compact />
        <nav aria-label="Öğrenci menüsü">
          <NavLink end to="/">Ana sayfa</NavLink>
          <NavLink to="/profil">Profilim</NavLink>
        </nav>
        <div className="user-menu">
          <span className="user-avatar" aria-hidden="true">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </span>
          <span className="user-menu__name">{user?.firstName} {user?.lastName}</span>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "Çıkılıyor…" : "Çıkış"}
          </button>
        </div>
      </header>
      <div className="portal-content">
        <Outlet />
      </div>
      <footer className="portal-footer">Geleceğin Fikri Platformu · Genç AR-GE</footer>
    </div>
  );
}
