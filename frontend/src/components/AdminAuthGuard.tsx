// AuthGuard — Sistem Admin (SystemAdmin rolü) ile giriş zorunlu sayfa koruyucusu.
//
// Sprint 11 — /admin/* route'ları için. SPA navigation: yetkisizse /giris'e yönlendir.
// Mevcut `me()` çağrısıyla kullanıcı bilgisi alınır, SystemAdmin rolü varsa geçer.

import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { me } from "../services/auth";
import { ApiHttpError } from "../services/api";

interface AdminAuthGuardProps {
  children: ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const [state, setState] = useState<"loading" | "unauthorized" | "ready">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bilgi = await me();
        if (cancelled) return;
        // me() → MeAuthenticated { authenticated: true, sessions: MeSession[] }.
        // Her oturumun kendi rolleri var. SystemAdmin rolü herhangi bir oturumda varsa onay.
        const isSystemAdmin = bilgi.authenticated
          ? bilgi.sessions.some((s) => s.roles?.includes("SystemAdmin"))
          : false;
        setState(isSystemAdmin ? "ready" : "unauthorized");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiHttpError && (err.status === 401 || err.status === 403)) {
          setState("unauthorized");
        } else {
          setState("unauthorized"); // hata durumunda da login'e yönlendir (güvenli default)
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="auth-modal-yukleniyor" role="status" aria-live="polite">
        Yetki kontrol ediliyor…
      </div>
    );
  }

  if (state === "unauthorized") {
    return <Navigate to="/giris" replace />;
  }

  return <>{children}</>;
}
