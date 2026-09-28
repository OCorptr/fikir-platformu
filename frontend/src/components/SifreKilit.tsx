// Sprint 11.60 / YG-17 — Zorunlu parola değiştirme kilidi.
//
// `me()` yanıtındaki `sifreDegistirmeZorunlu` bayrağı true ise kullanıcı
// uygulamanın hiçbir bölümüne erişemez; yalnızca /sifre-degistir ekranı
// açılır. Böylece 90 gün kuralı "öneri" değil, uygulanabilir bir zorunluluktur.
//
// Muafiyet backend'de de uygulanır (SifreYasiPolicy): sistem yöneticileri
// hiçbir zaman zorunluluk bayrağını görmez.

import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { me } from "../services/auth";
import { ApiHttpError } from "../services/api";
import { SifreDegistirPage } from "../pages/SifreDegistirPage";

/** Bu yollarda kilit devre dışıdır (kullanıcı bu ekranı görebilmeli). */
const SERBEST_YOLLAR = ["/sifre-degistir", "/giris", "/sifre-sifirla", "/sifremi-unuttum"];

export function SifreKilit({ children }: { children: ReactNode }) {
  const konum = useLocation();
  const [durum, setDurum] = useState<"belirsiz" | "serbest" | "zorunlu">("belirsiz");
  const [gerekce, setGerekce] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const bilgi = await me();
        if (iptal) return;
        if (!bilgi.authenticated) {
          setDurum("serbest");
          return;
        }
        const zorunluOturum = bilgi.sessions.find((s) => s.sifreDegistirmeZorunlu);
        if (zorunluOturum) {
          setGerekce(zorunluOturum.sifreDegistirmeGerekce ?? null);
          setDurum("zorunlu");
        } else {
          setDurum("serbest");
        }
      } catch (err) {
        if (iptal) return;
        // 401/403 veya ağ hatası: kullanıcı girişli değildir, kilitleme.
        if (err instanceof ApiHttpError && (err.status === 401 || err.status === 403)) {
          setDurum("serbest");
        } else {
          setDurum("serbest");
        }
      }
    })();
    return () => {
      iptal = true;
    };
  }, [konum.pathname]);

  if (durum === "belirsiz") {
    return (
      <div className="auth-modal-yukleniyor" role="status" aria-live="polite">
        Oturum kontrol ediliyor…
      </div>
    );
  }

  if (durum === "zorunlu" && !SERBEST_YOLLAR.includes(konum.pathname)) {
    return <SifreDegistirPage zorunlu gerekce={gerekce} />;
  }

  return <>{children}</>;
}
