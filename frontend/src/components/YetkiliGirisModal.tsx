// Yetkili Giriş Modalı — İl AR-GE personeli ve Bakanlık için (admin teması, sade).
// Çocuk temalı sarı/kayıt özellikleri yok — sadece e-posta + şifre.
// Açıldığında /me kontrol edilir: zaten province/ministry session varsa modal açılmadan
// doğrudan ilgili panele yönlendirilir (plan §49: "çıkış sonrası aynı sayfada kal" kuralı
// pasif session için geçerli — aktif oturum varsa yönlendir).

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { login, me, type LoginContext } from "../services/auth";
import { sessionForContext } from "../types";

interface Props {
  acik: boolean;
  onKapat: () => void;
}

export function YetkiliGirisModal({ acik, onKapat }: Props) {
  const navigate = useNavigate();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  // Modal açıldığında: zaten il/bakanlık oturumu varsa ilgili sayfaya yönlendir
  useEffect(() => {
    if (!acik) return;
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        const ministrySession = sessionForContext(cevap, "ministry");
        const provinceSession = sessionForContext(cevap, "province");
        if (ministrySession) {
          navigate("/bakanlik");
          onKapat();
        } else if (provinceSession) {
          navigate("/il-panel");
          onKapat();
        }
      })
      .catch(() => { /* oturum yoksa modal açık kalsın */ });
    return () => controller.abort();
  }, [acik, navigate, onKapat]);

  if (!acik) return null;

  async function handleGiris(olay: FormEvent) {
    olay.preventDefault();
    if (!eposta.trim() || !sifre) {
      setHata("E-posta ve şifre zorunludur.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      // context belirtmiyoruz — backend hesabın sahip olduğu role göre scheme seçsin.
      const sonuc = await login({ email: eposta.trim(), password: sifre });
      const ctx: LoginContext | undefined = (sonuc as { context?: string }).context as LoginContext | undefined;
      if (ctx === "province") {
        navigate("/il-panel");
      } else if (ctx === "ministry") {
        navigate("/bakanlik");
      } else {
        // Öğrenci veya bilinmeyen → bu modal öğrenci girişi için değil
        setHata("Bu giriş yalnızca il AR-GE personeli ve bakanlık yetkilileri içindir. Öğrenci girişi için 'Fikrimi Yaz'ı kullanın.");
      }
    } catch (e) {
      setHata(e instanceof ApiHttpError ? e.message : "Giriş başarısız.");
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div
      className="yg-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yg-baslik"
      onClick={(olay) => {
        if (olay.target === olay.currentTarget) onKapat();
      }}
    >
      <div className="yg-kart">
        <button
          type="button"
          className="yg-kapat"
          aria-label="Kapat"
          onClick={onKapat}
        >
          ✕
        </button>

        <div className="yg-marka">
          <img src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE" />
          <div>
            <b>GELECEĞİN FİKRİ</b>
            <small>Yetkili Girişi</small>
          </div>
        </div>

        <h2 id="yg-baslik" className="yg-baslik">Yetkili Paneli</h2>
        <p className="yg-alt">
          İl AR-GE birimi veya bakanlık yetkilisiyseniz hesabınızla giriş yapın.
        </p>

        {hata && (
          <div className="status-banner status-banner--error" role="alert">
            <span className="status-banner__icon">!</span>
            <span>{hata}</span>
          </div>
        )}

        <form onSubmit={handleGiris} className="yg-form">
          <label className="yg-alan">
            <span>E-posta</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              placeholder="ad.soyad@….gov.tr"
            />
          </label>

          <label className="yg-alan">
            <span>Şifre</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            className="yg-giris"
            disabled={calisiyor}
          >
            {calisiyor ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>

        <div className="yg-not">
          🔒 Öğrenci hesabınızla giriş yapmak için anasayfadaki <b>Fikrimi Yaz</b> butonunu kullanın.
        </div>
      </div>
    </div>
  );
}
