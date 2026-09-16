import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="loading-screen" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <p>Oturumunuz kontrol ediliyor…</p>
      </main>
    );
  }

  if (status === "anonymous") {
    return <Navigate to="/giris" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
