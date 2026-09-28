// Sprint 6 — admin rotaları için kimlik koruması.
// context belirtilen scheme'in oturumu yoksa anasayfaya yönlendirir; sayfa hiç
// yüklenmez (flash yok). React Router nested route: <Outlet /> ile alt route'ları render eder.

import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { me } from "../services/auth";
import { sessionForContext, type MeResponse } from "../types";

type AuthContext = "student" | "province" | "ministry";

interface Props {
  /** Bu context'in oturumu olmalı: "student" | "province" | "ministry". */
  context: AuthContext;
}

export function ProtectedRoute({ context }: Props) {
  const [cevap, setCevap] = useState<MeResponse | null>(null);
  const [bitti, setBitti] = useState(false);
  const yol = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => setCevap(c))
      .catch(() => setCevap(null))
      .finally(() => setBitti(true));
    return () => controller.abort();
  }, []);

  // /me hâlâ bekleniyorsa boş (flash önleme) — auth cookie zaten HTTP-only +
  // same-site, browser navigate anında /me'yi başlatır; redirect kararı ms
  // içinde verilir.
  if (!bitti) {
    return (
      <div className="sayfa-yukleniyor" style={{ padding: "4rem", textAlign: "center" }}>
        Yükleniyor…
      </div>
    );
  }

  const oturumVar = cevap ? sessionForContext(cevap, context) : null;
  if (oturumVar) return <Outlet />;

  // Onur (S11.77): Sessizce ana sayfaya atmak bu hatayi gorunmez kiliyordu.
  // "Sistem Yoneticisi il-panel'a giremiyor" 4 tur kok neden bulunamadi -
  // tam da bu yuzden: kullanici hicbir mesaj gormuyor, ben tahmin yurutuyordum.
  // Artik durum ACIKLANIR ve panel listesine donulur.
  if (cevap?.authenticated) {
    return (
      <div className="mfa-kart-sayfa">
        <div className="mfa-kart" role="alert">
          <h1 className="mfa-baslik">Bu panele erişiminiz yok</h1>
          <p className="mfa-mesaj">
            Hesabınız açık ama bu panel için oturum bulunamadı. Hesabınızdaki
            roller: {cevap.roles?.join(", ") || "belirlenmemiş"}
          </p>
          <div className="mfa-eylem">
            <a className="mfa-geri" href="/">
              Panellerime dön
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <Navigate to="/" replace state={{ from: yol.pathname }} />;
}
