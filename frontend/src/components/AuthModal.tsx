// /fikir sayfasında kullanılan giriş/kayıt modalı.
// Fikrini Anlat teması: .fikir-karti, .balon, .bolum-basligi, .tema-secim, .btn-ana.
// Kapatılamaz — kullanıcı yalnız giriş veya kayıt yoluyla forma ulaşır.
// Onur feedback (Sprint 10.3):
//   Cross-context guard — yetkili session (province/ministry) açıksa
//   öğrenci login yapılamaz. Modal açılınca /me kontrol edilir.

import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiHttpError } from "../services/api";
import { contextFromPath, login, register, logout, me, type LoginContext } from "../services/auth";
import { getProvinces } from "../services/references";
import { sessionForContext } from "../types";
import type { ProvinceRef } from "../types";
import { CaptchaField } from "./CaptchaField";

type Mod = "giris" | "kayit" | "dogrulamaBekleniyor";

interface Props {
  acik: boolean;
  /** auth başarılı olduğunda çağrılır (FikirPage yeniden /me çeker). */
  onAuthed: () => void;
  /** true → yalnız Giriş Yap sekmesi gösterilir (Kayıt Ol gizlenir); il personeli için. */
  sadeceGiris?: boolean;
  /** Hangi panele giriş yapıldığı (plan §49). Login backend'e iletilir. */
  context?: LoginContext;
  /** true → lightbox arka planda kalır (maskot + .maskot-ust-yazi önde). */
  arkadaMi?: boolean;
  /** sekme değiştiğinde çağrılır — FikirPage maskot balonunu buna göre günceller */
  onModChange?: (mod: Mod) => void;
}

export function AuthModal({ acik, onAuthed, sadeceGiris = false, context: contextProp, arkadaMi = false, onModChange }: Props) {
  const navigate = useNavigate();
  // Path'ten context algıla (prop verilmediyse).
  const yol = useLocation().pathname;
  const context: LoginContext | undefined = contextProp ?? contextFromPath(yol);
  const [mod, setMod] = useState<Mod>("giris");
  const [iller, setIller] = useState<ProvinceRef[]>([]);
  const [illerYukleniyor, setIllerYukleniyor] = useState(false);

  // Giriş
  const [girisEposta, setGirisEposta] = useState("");
  const [girisSifre, setGirisSifre] = useState("");
  const [girisCaptchaId, setGirisCaptchaId] = useState("");
  const [girisCaptchaCevap, setGirisCaptchaCevap] = useState("");

  // Kayıt
  const [kayitAd, setKayitAd] = useState("");
  const [kayitSoyad, setKayitSoyad] = useState("");
  const [kayitIlId, setKayitIlId] = useState<number | "">("");
  const [kayitOkul, setKayitOkul] = useState("");
  const [kayitSinif, setKayitSinif] = useState<number | "">("");
  const [kayitOkulNo, setKayitOkulNo] = useState("");
  const [kayitEposta, setKayitEposta] = useState("");
  const [kayitSifre, setKayitSifre] = useState("");
  const [kayitCaptchaId, setKayitCaptchaId] = useState("");
  const [kayitCaptchaCevap, setKayitCaptchaCevap] = useState("");

  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [yetkiliOturumAcik, setYetkiliOturumAcik] = useState<LoginContext | null>(null);

  // Cross-context guard: Modal her açılışında /me çağırır. Province/ministry
  // session varsa öğrenci login yapılamaz — banner + logout butonu göster.
  useEffect(() => {
    if (!acik) {
      setYetkiliOturumAcik(null);
      return;
    }
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        if (sessionForContext(cevap, "ministry")) setYetkiliOturumAcik("ministry");
        else if (sessionForContext(cevap, "province")) setYetkiliOturumAcik("province");
        else setYetkiliOturumAcik(null);
      })
      .catch(() => setYetkiliOturumAcik(null));
    return () => controller.abort();
  }, [acik]);

  // Mod değiştiğinde dışarıya bildir (FikirPage maskot balonunu buna göre günceller)
  useEffect(() => {
    onModChange?.(mod);
  }, [mod, onModChange]);

  // Modal her açılışında illeri yükle (kapandığında sıfırla ki her seferinde fresh gelsin)
  useEffect(() => {
    if (!acik) {
      setIller([]);
      setIllerYukleniyor(false);
      return;
    }
    const controller = new AbortController();
    setIllerYukleniyor(true);
    getProvinces(controller.signal)
      .then((liste) => setIller(liste))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          const aciklama =
            e instanceof ApiHttpError
              ? `${e.status} ${e.message}`
              : e instanceof Error
                ? e.message
                : String(e);
          setHata(`İl listesi yüklenemedi: ${aciklama}`);
        }
      })
      .finally(() => setIllerYukleniyor(false));
    return () => controller.abort();
  }, [acik]);

  if (!acik) return null;

  // Onur feedback (Sprint 10.3): Yetkili oturum açıksa öğrenci login yapılamaz.
  // Sadece banner + 'Çıkış yap' göster, normal auth akışını render etme.
  if (yetkiliOturumAcik) {
    return (
      <div
        className={`af-lightbox ${arkadaMi ? "af-lightbox-arkada" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-baslik"
      >
        <div className="fikir-karti auth-modal-kart">
          <h1 id="auth-modal-baslik" className="auth-modal-baslik">
            <span style={{ color: "#1f9fa4" }}>Fikrine</span>{" "}
            <span style={{ color: "#ef7814" }}>Hoş Geldin!</span>
          </h1>
          <div className="yg-aktif-oturum" role="status">
            <div className="yg-aktif-oturum__baslik">
              ⚠️ Yetkili oturum açık
              <small>({yetkiliOturumAcik === "ministry" ? "Bakanlık" : "İl AR-GE"})</small>
            </div>
            <p className="yg-aktif-oturum__metin">
              Bu tarayıcıda yetkili hesapla oturum açık. Öğrenci girişi için
              önce çıkış yapın. İki farklı hesap aynı anda açık olamaz.
            </p>
            <div className="yg-aktif-oturum__butonlar">
              <button
                type="button"
                className="yg-cikis"
                onClick={async () => {
                  setCalisiyor(true);
                  try { await logout(); } catch { /* yine de kapat */ }
                  setYetkiliOturumAcik(null);
                  setCalisiyor(false);
                  onAuthed();
                }}
                disabled={calisiyor}
              >
                {calisiyor ? "Çıkış yapılıyor…" : "Çıkış yap"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const balikMesaji =
    mod === "giris"
      ? <>Merhaba! Fikrini yazmadan önce <b>hesabınla giriş yap</b> ya da yeni bir hesap oluştur. Sıra sende! 🖐</>
      : mod === "kayit"
        ? <>Yeni misin? <b>Hesap oluştur</b>, e-postanı doğrula, sonra fikrini yaz. Birkaç saniye sürer! 🚀</>
        : <>E-posta kutunu kontrol et! 🎉 Doğrulama bağlantısına tıkladıktan sonra <b>giriş yapabilirsin</b>.</>;

  async function handleGiris(olay: FormEvent) {
    olay.preventDefault();
    if (!girisEposta.trim() || !girisSifre) {
      setHata("E-posta ve şifre zorunludur.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await login({
        email: girisEposta.trim(),
        password: girisSifre,
        context,
        captchaId: girisCaptchaId,
        captchaAnswer: girisCaptchaCevap,
      });
      // MFA setup gerekiyor (Sprint 9) → /mfa-setup sayfasına yönlendir.
      if (sonuc.mfaSetupRequired) {
        navigate("/mfa-setup");
        return;
      }
      // MFA code gerekiyor (Sprint 9) → /mfa-login sayfasına yönlendir.
      if (sonuc.mfaRequired) {
        navigate("/mfa-login");
        return;
      }
      onAuthed();
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(false);
    }
  }

  async function handleKayit(olay: FormEvent) {
    olay.preventDefault();
    if (!kayitAd.trim() || !kayitSoyad.trim()) {
      setHata("Ad ve soyad zorunludur.");
      return;
    }
    if (!kayitIlId) {
      setHata("İl seçimi zorunludur.");
      return;
    }
    if (!kayitEposta.trim() || !kayitSifre || kayitSifre.length < 5) {
      setHata("E-posta zorunlu; şifre en az 5 karakter olmalı.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      await register({
        firstName: kayitAd.trim(),
        lastName: kayitSoyad.trim(),
        email: kayitEposta.trim(),
        password: kayitSifre,
        provinceId: kayitIlId as number,
        school: kayitOkul.trim() ? kayitOkul.trim() : null,
        grade: kayitSinif === "" ? null : kayitSinif,
        studentNumber: kayitOkulNo.trim() ? kayitOkulNo.trim() : null,
        captchaId: kayitCaptchaId,
        captchaAnswer: kayitCaptchaCevap,
      });
      setMod("dogrulamaBekleniyor");
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div
      className={`af-lightbox ${arkadaMi ? "af-lightbox-arkada" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-baslik"
      // dışarı tıklayınca kapatma yok — kullanıcı ancak giriş/kayıt yaparak çıkabilir
    >
      <div className="fikir-karti auth-modal-kart">
        <h1 id="auth-modal-baslik" className="auth-modal-baslik">
          <span style={{ color: "#1f9fa4" }}>Fikrine</span>{" "}
          <span style={{ color: "#ef7814" }}>Hoş Geldin!</span>
        </h1>

        {/* Onur feedback (Sprint 10.3): Cross-context guard.
            Yetkili oturum (province/ministry) açıksa öğrenci login yapılamaz. */}
        {yetkiliOturumAcik && (
          <div className="yg-aktif-oturum" role="status">
            <div className="yg-aktif-oturum__baslik">
              ⚠️ Yetkili oturum açık
              <small>({yetkiliOturumAcik === "ministry" ? "Bakanlık" : "İl AR-GE"})</small>
            </div>
            <p className="yg-aktif-oturum__metin">
              Bu tarayıcıda yetkili hesapla oturum açık. Öğrenci girişi için
              önce çıkış yapın. İki farklı hesap aynı anda açık olamaz.
            </p>
            <div className="yg-aktif-oturum__butonlar">
              <button
                type="button"
                className="yg-cikis"
                onClick={async () => {
                  setCalisiyor(true);
                  try { await logout(); } catch { /* yine de kapat */ }
                  setYetkiliOturumAcik(null);
                  setCalisiyor(false);
                  onAuthed();
                }}
                disabled={calisiyor}
              >
                {calisiyor ? "Çıkış yapılıyor…" : "Çıkış yap"}
              </button>
            </div>
          </div>
        )}

        {!yetkiliOturumAcik && mod !== "dogrulamaBekleniyor" && !sadeceGiris && (
          <div className="auth-sekmeler" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mod === "giris"}
              className={`auth-sekme ${mod === "giris" ? "aktif" : ""}`}
              onClick={() => { setMod("giris"); setHata(null); }}
            >
              🔑 Giriş Yap
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mod === "kayit"}
              className={`auth-sekme ${mod === "kayit" ? "aktif" : ""}`}
              onClick={() => { setMod("kayit"); setHata(null); }}
            >
              ✨ Kayıt Ol
            </button>
          </div>
        )}

        {hata && (
          <div className="status-banner status-banner--error" role="alert">
            <span className="status-banner__icon">!</span>
            <span>{hata}</span>
          </div>
        )}

        {mod === "giris" && (
          <form onSubmit={handleGiris} className="auth-form">
            <div className="bolum-basligi mavi">E-posta</div>
            <input
              className="tema-input"
              type="email"
              autoComplete="email"
              required
              value={girisEposta}
              onChange={(e) => setGirisEposta(e.target.value)}
              placeholder=""
            />
            <div className="bolum-basligi turuncu">Şifre</div>
            <input
              className="tema-input"
              type="password"
              autoComplete="current-password"
              required
              value={girisSifre}
              onChange={(e) => setGirisSifre(e.target.value)}
              placeholder="••••••••"
            />
            <CaptchaField
              id="giris-captcha"
              value={girisCaptchaCevap}
              onChange={setGirisCaptchaCevap}
              captchaId={girisCaptchaId}
              onCaptchaIdChange={setGirisCaptchaId}
            />
            <div className="fikir-butonlar">
              <button
                type="submit"
                className="btn-ana btn-tam"
                disabled={calisiyor}
              >
                {calisiyor ? "Giriş yapılıyor…" : "Giriş Yap 🚀"}
              </button>
            </div>
          </form>
        )}

        {mod === "kayit" && (
          <form onSubmit={handleKayit} className="auth-form">
            <div className="auth-iki-sutun">
              <div className="alan">
                <span>Ad</span>
                <input
                  className="tema-input"
                  required
                  value={kayitAd}
                  onChange={(e) => setKayitAd(e.target.value)}
                  placeholder="Adın"
                  maxLength={40}
                />
              </div>
              <div className="alan">
                <span>Soyad</span>
                <input
                  className="tema-input"
                  required
                  value={kayitSoyad}
                  onChange={(e) => setKayitSoyad(e.target.value)}
                  placeholder="Soyadın"
                  maxLength={40}
                />
              </div>
            </div>

            <div className="auth-iki-sutun">
              <div className="alan">
                <span>İl</span>
                <select
                  className="tema-secim"
                  required
                  value={kayitIlId}
                  onChange={(e) => setKayitIlId(e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={illerYukleniyor}
                >
                  <option value="">
                    {illerYukleniyor ? "İller yükleniyor…" : "İl seç…"}
                  </option>
                  {iller.map((il) => (
                    <option key={il.id} value={il.id}>{il.name}</option>
                  ))}
                </select>
              </div>
              <div className="alan">
                <span>Okul Adı</span>
                <input
                  className="tema-input"
                  value={kayitOkul}
                  onChange={(e) => setKayitOkul(e.target.value)}
                  placeholder=""
                  maxLength={80}
                />
              </div>
            </div>

            <div className="auth-iki-sutun">
              <div className="alan">
                <span>Sınıf</span>
                <select
                  className="tema-secim"
                  value={kayitSinif}
                  onChange={(e) => setKayitSinif(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Sınıf seç…</option>
                  <optgroup label="İlkokul">
                    {[1, 2, 3, 4].map((s) => (
                      <option key={s} value={s}>{s}. sınıf</option>
                    ))}
                  </optgroup>
                  <optgroup label="Ortaokul">
                    {[5, 6, 7, 8].map((s) => (
                      <option key={s} value={s}>{s}. sınıf</option>
                    ))}
                  </optgroup>
                  <optgroup label="Lise">
                    {[9, 10, 11, 12].map((s) => (
                      <option key={s} value={s}>{s}. sınıf</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="alan">
                <span>Okul No</span>
                <input
                  className="tema-input"
                  inputMode="numeric"
                  value={kayitOkulNo}
                  onChange={(e) => setKayitOkulNo(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  placeholder="1045"
                  maxLength={12}
                />
              </div>
            </div>

            <div className="auth-iki-sutun">
              <div className="alan">
                <span>E-posta</span>
                <input
                  className="tema-input"
                  type="email"
                  autoComplete="email"
                  required
                  value={kayitEposta}
                  onChange={(e) => setKayitEposta(e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="alan">
                <span>Şifre <span className="not">(en az 5 karakter)</span></span>
                <input
                  className="tema-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={5}
                  value={kayitSifre}
                  onChange={(e) => setKayitSifre(e.target.value)}
                  placeholder="•••••"
                />
              </div>
            </div>

            <CaptchaField
              id="kayit-captcha"
              value={kayitCaptchaCevap}
              onChange={setKayitCaptchaCevap}
              captchaId={kayitCaptchaId}
              onCaptchaIdChange={setKayitCaptchaId}
            />

            <div className="fikir-butonlar">
              <button
                type="submit"
                className="btn-ana btn-tam"
                disabled={calisiyor}
              >
                {calisiyor ? "Kayıt yapılıyor…" : "Kayıt Ol 🎉"}
              </button>
            </div>
          </form>
        )}

        {mod === "dogrulamaBekleniyor" && (
          <div className="auth-bilgi">
            <p>
              <b>{kayitEposta}</b> adresine doğrulama bağlantısı gönderdik.
              Geliştirme ortamında e-posta <code>backend/src/FikirPlatformu.Api/dev-email/</code>
              klasörüne dosya olarak yazılır — oradan açabilirsin.
            </p>
            <button
              type="button"
              className="btn-ikincil"
              onClick={() => { setMod("giris"); setHata(null); }}
            >
              Giriş ekranına dön
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}

