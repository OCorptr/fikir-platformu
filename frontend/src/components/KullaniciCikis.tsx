// YEĞİTEK madde 20 — "Kullanıcı, her sayfadan oturumunu sonlandırabilmelidir."
//
// Sprint 11.62: Bileşen UYGULAMANIN TAMAMINA tek noktadan bağlandı (App.tsx).
// Önceden yalnızca `PublicLayout` içinde render ediliyordu ve PublicLayout
// hiçbir yerde kullanılmıyordu — yani çıkış butonu pratikte hiçbir sayfada
// görünmüyordu. İl paneli (/il-panel/*) ve bakanlık paneli (/bakanlik/*)
// sayfalarında hiç çıkış yolu yoktu.
//
// Davranış:
//   - Oturum yoksa hiçbir şey render etmez.
//   - `/admin/*` altında render edilmez (AdminLayout kendi çıkış menüsünü
//     içeriyor; iki buton üst üste binmesin).
//   - Hangi oturumun kapatılacağı, açık olan sayfanın yolundan çıkarılır
//     (il-panel → province, bakanlik → ministry, fikir → student).

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logout, me, contextFromPath, type LoginContext } from "../services/auth";

export function KullaniciCikis() {
  const [girisYapildi, setGirisYapildi] = useState(false);
  const navigate = useNavigate();
  const konum = useLocation();

  // Not: hook'lar koşulsuz çağrılmalı — erken dönüş aşağıda, hook'lardan
  // SONRA yapılır.
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => setGirisYapildi(cevap.authenticated))
      .catch(() => setGirisYapildi(false));
    return () => controller.abort();
  }, [konum.pathname]);

  // Admin panelinde kendi çıkış menüsü var; çakışma olmasın.
  if (konum.pathname.startsWith("/admin")) return null;
  if (!girisYapildi) return null;

  const handleClick = async () => {
    const ctx: LoginContext | undefined = contextFromPath(konum.pathname);
    try {
      await logout(ctx);
    } catch {
      // Sunucu hata verse bile yerel durum temizlensin.
    }
    setGirisYapildi(false);
    navigate("/", { replace: true });
  };

  return (
    <button
      type="button"
      className="kullanici-cikis"
      onClick={handleClick}
      aria-label="Oturumu kapat, çıkış yap"
      title="Çıkış yap"
    >
      🚪 Çıkış Yap
    </button>
  );
}
