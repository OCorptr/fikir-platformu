// Yetkili Giriş Modalı — İl AR-GE personeli ve Bakanlık için (admin teması, sade).
// Çocuk temalı sarı/kayıt özellikleri yok — sadece e-posta + şifre.
// Onur feedback (Sprint 10.2-3):
//   * Otomatik /bakanlik veya /il-panel'e yönlendirme YAPILMAZ.
//   * HERHANGI bir context'te (province/ministry/student) oturum açıksa
//     login formu GİZLİLİR. Banner + 'Çıkış yap' gösterilir — başka
//     context'te login yapılamaz. Hangi context'te oturum açıksa
//     o panele yönlendiren buton gösterilir.
//   * Hiç oturum yoksa form gösterilir (normal login akışı).
//
// Sprint 10.7+++ fix:
//   * useNavigate() imperative + <Navigate> declarative navigation Modal
//     içinde SPA history.pushState tetiklemiyor (React Router v7 +
//     React 19 + Modal render loop uyumsuz). Hem imperatif hem
//     deklaratif denedik: SPA nav çağrıldı ama URL değişmedi.
//   * Çözüm: window.location.href ile full page navigation. SPA davranışı
//     hafif kaybeder (kısa beyaz ekran), ama Onur'un hesabıyla
//     doğru route'a ULAŞMA garantilenir. Daha sonra Router v8 upgrade
//     veya React Router'ın data router pattern'i denenecek.

import { useEffect, useState, type FormEvent } from "react";
import { ApiHttpError } from "../services/api";
import { login, logout, me, mfaGetMethod, type LoginContext } from "../services/auth";
import { sessionForContext } from "../types";
import { CaptchaField } from "./CaptchaField";

interface Props {
  acik: boolean;
  onKapat: () => void;
}

// SPA navigasyon YetkiliGirisModal içinde çalışmadığı için window.location
// kullanıyoruz. Hedef route'u yumuşak path belirler (replace=false → back
// çalışır).
function fullPageNav(hedef: string) {
  window.location.href = hedef;
}

export function YetkiliGirisModal({ acik, onKapat }: Props) {
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaCevap, setCaptchaCevap] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [aktifOturum, setAktifOturum] = useState<LoginContext | null>(null);
  // Sprint 10.7: initial state TRUE. İlk render'da form flash'lanmasın.
  // useEffect mount olunca setOturumYukleniyor(false) ancak me() cevabı ile.
  const [oturumYukleniyor, setOturumYukleniyor] = useState(true);

  // Modal açıldığında: önce PreMfa cookie var mı kontrol et (MFA halfway
  // state). Varsa → /mfa-login'e yönlendir (Onur feedback: MFA devam
  // ederken yetkili login yapılabilmesin). Yoksa /me ile mevcut oturumun
  // context'ini bul. province / ministry / student — hangisi varsa form
  // gizlenir.
  useEffect(() => {
    if (!acik) {
      setAktifOturum(null);
      setOturumYukleniyor(true);
      return;
    }
    const controller = new AbortController();
    // Önce MFA halfway kontrolü: PreMfa cookie varsa /mfa-login'e at.
    mfaGetMethod()
      .then(() => {
        // PreMfa cookie mevcut → MFA akışı devam ediyor, login yapılamaz.
        // Modal'ı kapat ve full page navigation tetikle.
        onKapat();
        fullPageNav("/mfa-login");
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          // PreMfa cookie yok veya hata — /me ile mevcut oturumu kontrol et.
          me(controller.signal)
            .then((cevap) => {
              if (sessionForContext(cevap, "ministry")) setAktifOturum("ministry");
              else if (sessionForContext(cevap, "province")) setAktifOturum("province");
              else if (sessionForContext(cevap, "student")) setAktifOturum("student");
              else setAktifOturum(null);
            })
            .catch(() => setAktifOturum(null))
            .finally(() => setOturumYukleniyor(false));
        }
      });
    return () => controller.abort();
  }, [acik]);

  if (!acik) return null;

  // /me cevabı bekleniyor — form banner gösterme (yanıltıcı olur).
  if (oturumYukleniyor && aktifOturum === null) {
    return (
      <div className="yg-lightbox" role="dialog" aria-modal="true">
        <div className="yg-kart">
          <div className="yg-marka">
            <img src="/assets/img/gencarge_logo.webp" alt="Genç AR-GE" />
            <div>
              <b>GELECEĞİN FİKRİ</b>
              <small>Yetkili Girişi</small>
            </div>
          </div>
          <h2 className="yg-baslik">Oturum kontrol ediliyor…</h2>
          <p className="yg-alt">Lütfen bekleyin.</p>
        </div>
      </div>
    );
  }

  const oturumEtiketi =
    aktifOturum === "ministry" ? "Bakanlık"
    : aktifOturum === "province" ? "İl AR-GE"
    : aktifOturum === "student" ? "Öğrenci"
    : null;

  function paneleGit() {
    // Modal içinde SPA nav çalışmıyor — fullPageNav kullan.
    const hedef =
      aktifOturum === "ministry" ? "/bakanlik"
      : aktifOturum === "province" ? "/il-panel"
      : aktifOturum === "student" ? "/fikir"
      : null;
    if (hedef) {
      fullPageNav(hedef);
    }
  }

  async function cikisYap() {
    setCalisiyor(true);
    try {
      // Tüm scheme cookie'leri silinir (logout endpoint'i hepsini temizler).
      await logout();
    } catch {
      // yine de modalı kapat
    } finally {
      setAktifOturum(null);
      setEposta("");
      setSifre("");
      setCaptchaCevap("");
      setCaptchaId("");
      setHata(null);
      setCalisiyor(false);
    }
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
      // Sprint 10.7+++ Modal içinde SPA nav çalışmıyor; full page load.
      if (sonuc.mfaSetupRequired) {
        fullPageNav("/mfa-setup");
        return;
      }
      // MFA code gerekiyor → /mfa-login sayfasına yönlendir (Sprint 9).
      if (sonuc.mfaRequired) {
        fullPageNav("/mfa-login");
        return;
      }
      const ctx: LoginContext | undefined = sonuc.context as LoginContext | undefined;
      if (ctx === "province") {
        fullPageNav("/il-panel");
      } else if (ctx === "ministry") {
        fullPageNav("/bakanlik");
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

        {/* Onur feedback: session varken form GÖSTERİLMEZ, sadece banner + butonlar.
            Tekrar giriş için önce 'Çıkış yap' butonu zorunlu. */}
        {aktifOturum ? (
          <div className="yg-aktif-oturum" role="status">
            <div className="yg-aktif-oturum__baslik">
              ✓ Bu tarayıcıda oturum açık
              <small>({oturumEtiketi})</small>
            </div>
            <p className="yg-aktif-oturum__metin">
              Zaten giriş yapmışsınız ({oturumEtiketi}). Panele gitmek için aşağıdaki butonu kullanın.
              <br />
              Farklı bir hesapla girmek için önce <b>Çıkış yap</b>'a basın.
            </p>
            <div className="yg-aktif-oturum__butonlar">
              <button type="button" className="yg-ikincil" onClick={paneleGit}>
                {aktifOturum === "ministry" ? "Bakanlık paneline git →"
                  : aktifOturum === "province" ? "İl paneline git →"
                  : "Fikirlerime git →"}
              </button>
              <button type="button" className="yg-cikis" onClick={cikisYap} disabled={calisiyor}>
                {calisiyor ? "Çıkış yapılıyor…" : "Çıkış yap"}
              </button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
