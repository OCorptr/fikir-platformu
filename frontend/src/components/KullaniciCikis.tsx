// PublicLayout için "giriş yapmış kullanıcı" çıkış butonu.
// AdminLayout'taki dropdown'dan bağımsız, sade /fikir, /, /profil gibi
// sayfalarda "çıkış yap" linki sağlar (YEĞİTEK gereksinim #20).
// /me ile session kontrolü yapıp, giriş yapılmışsa butonu render eder.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/auth";
import { me } from "../services/auth";

export function KullaniciCikis() {
  const [girisYapildi, setGirisYapildi] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => setGirisYapildi(cevap.authenticated))
      .catch(() => setGirisYapildi(false));
    return () => controller.abort();
  }, []);

  const handleClick = async () => {
    try {
      await logout();
    } catch {
      // yoksay — yine de yönlendir
    }
    setGirisYapildi(false);
    navigate("/", { replace: true });
  };

  if (!girisYapildi) return null;

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