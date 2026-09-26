// Yetkili Giriş Modalı — İl AR-GE personeli ve Bakanlık için (admin teması, sade).
// Çocuk temalı sarı/kayıt özellikleri yok — sadece e-posta + şifre.
// Onur feedback (Sprint 10.2):
//   Otomatik /bakanlik veya /il-panel'e yönlendirme KALDIRILDI.
//   Authenticated kullanıcı her açılışta login modalini gorur
//   (farkli hesap test etmek veya 'Cikis' yapmak icin).
//   Modal icinde 'Oturum Acik' banner + 'Panele Git' + 'Cikis Yap' butonlari.

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { login, logout, me, type LoginContext } from "../services/auth";
import { sessionForContext } from "../types";
import { CaptchaField } from "./CaptchaField";

interface Props {
  acik: boolean;
  onKapat: () => void;
}

export function YetkiliGirisModal({ acik, onKapat }: Props) {
  const navigate = useNavigate();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaCevap, setCaptchaCevap] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [aktifOturum, setAktifOturum] = useState<LoginContext | null>(null);

  // Modal açıldığında: /me ile mevcut oturumu kontrol et.
  // Onur feedback: mevcut oturum Varsa bile otomatik yönlendirme YAPMA.
  // Sadece bilgi olarak banner + 'Panele Git' + 'Çıkış Yap' butonlari göster.
  useEffect(() => {
    if (!acik) {
      setAktifOturum(null);
      return;
    }
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        if (sessionForContext(cevap, "ministry")) setAktifOturum("ministry");
        else if (sessionForContext(cevap, "province")) setAktifOturum("province");
        else setAktifOturum(null);
      })
      .catch(() => setAktifOturum(null));
    return () => controller.abort();
  }, [acik]);

  if (!acik) return null;

  function paneleGit() {
    if (aktifOturum === "ministry") navigate("/bakanlik");
    else if (aktifOturum === "province") navigate("/il-panel");
    onKapat();
  }

  async function cikisYap() {
    try {
      await logout();
    } catch {
      // yine de modalı kapat
    }
    setAktifOturum(null);
    setEposta("");
    setSifre("");
    setCaptchaCevap("");
    setCaptchaId("");
    setHata(null);
  }

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
      const sonuc = await login({
        email: eposta.trim(),
        password: sifre,
        captchaId,
        captchaAnswer: captchaCevap,
      });
      // MFA setup gerekiyor → /mfa-setup sayfasına yönlendir (Sprint 9).
      if (sonuc.mfaSetupRequired) {
        navigate("/mfa-setup");
        onKapat();
        return;
      }
      // MFA code gerekiyor → /mfa-login sayfasına yönlendir (Sprint 9).
      if (sonuc.mfaRequired) {
        navigate("/mfa-login");
        onKapat();
        return;
      }
      const ctx: LoginContext | undefined = sonuc.context as LoginContext | undefined;
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

        {aktifOturum && (
          <div className="yg-aktif-oturum" role="status">
            <div className="yg-aktif-oturum__baslik">
              ✓ Bu tarayıcıda oturum açık
              <small>({aktifOturum === "ministry" ? "Bakanlık" : "İl AR-GE"})</small>
            </div>
            <div className="yg-aktif-oturum__butonlar">
              <button type="button" className="yg-ikincil" onClick={paneleGit}>
                {aktifOturum === "ministry" ? "Bakanlık paneline git →" : "İl paneline git →"}
              </button>
              <button type="button" className="yg-cikis" onClick={cikisYap} disabled={calisiyor}>
                Çıkış yap
              </button>
            </div>
            <p className="yg-aktif-oturum__not">
              ℹ️ Farklı hesapla girmek için aşağıya yeni bilgileri yazabilir veya "Çıkış yap"a basabilirsiniz.
            </p>
          </div>
        )}

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

          <CaptchaField
            id="yetkili-captcha"
            value={captchaCevap}
            onChange={setCaptchaCevap}
            captchaId={captchaId}
            onCaptchaIdChange={setCaptchaId}
          />

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
