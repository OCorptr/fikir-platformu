// /fikir sayfasında kullanılan giriş/kayıt modalı.
// Fikrini Anlat teması: .fikir-karti, .balon, .bolum-basligi, .tema-secim, .btn-ana.
// Kapatılamaz — kullanıcı yalnız giriş veya kayıt yoluyla forma ulaşır.

import { useEffect, useState, type FormEvent } from "react";
import { ApiHttpError } from "../services/api";
import { login, register } from "../services/auth";
import { getProvinces } from "../services/references";
import type { ProvinceRef } from "../types";

type Mod = "giris" | "kayit" | "dogrulamaBekleniyor";

interface Props {
  acik: boolean;
  /** auth başarılı olduğunda çağrılır (FikirPage yeniden /me çeker). */
  onAuthed: () => void;
}

export function AuthModal({ acik, onAuthed }: Props) {
  const [mod, setMod] = useState<Mod>("giris");
  const [iller, setIller] = useState<ProvinceRef[]>([]);
  const [illerYukleniyor, setIllerYukleniyor] = useState(false);

  // Giriş
  const [girisEposta, setGirisEposta] = useState("");
  const [girisSifre, setGirisSifre] = useState("");

  // Kayıt
  const [kayitAd, setKayitAd] = useState("");
  const [kayitSoyad, setKayitSoyad] = useState("");
  const [kayitIlId, setKayitIlId] = useState<number | "">("");
  const [kayitEposta, setKayitEposta] = useState("");
  const [kayitSifre, setKayitSifre] = useState("");

  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  // Modal ilk açıldığında illeri yükle
  useEffect(() => {
    if (!acik || iller.length > 0) return;
    const controller = new AbortController();
    setIllerYukleniyor(true);
    getProvinces(controller.signal)
      .then((liste) => setIller(liste))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata("İl listesi yüklenemedi. Sayfayı yenile.");
        }
      })
      .finally(() => setIllerYukleniyor(false));
    return () => controller.abort();
  }, [acik, iller.length]);

  if (!acik) return null;

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
      await login({ email: girisEposta.trim(), password: girisSifre });
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
    if (!kayitEposta.trim() || !kayitSifre || kayitSifre.length < 8) {
      setHata("E-posta zorunlu; şifre en az 8 karakter olmalı.");
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
      className="af-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-baslik"
      // dışarı tıklayınca kapatma yok — kullanıcı ancak giriş/kayıt yaparak çıkabilir
    >
      <div className="fikir-karti auth-modal-kart">
        <div className="balon-kapsa">
          <div className="balon">{balikMesaji}</div>
        </div>

        <h1 id="auth-modal-baslik" className="auth-modal-baslik">
          <span style={{ color: "#1f9fa4" }}>Fikrine</span>{" "}
          <span style={{ color: "#ef7814" }}>Hoş Geldin!</span>
        </h1>

        {mod !== "dogrulamaBekleniyor" && (
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
              className="tema-secim"
              type="email"
              autoComplete="email"
              required
              value={girisEposta}
              onChange={(e) => setGirisEposta(e.target.value)}
              placeholder="ornek@okul.edu.tr"
            />
            <div className="bolum-basligi turuncu">Şifre</div>
            <input
              className="tema-secim"
              type="password"
              autoComplete="current-password"
              required
              value={girisSifre}
              onChange={(e) => setGirisSifre(e.target.value)}
              placeholder="••••••••"
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
                  className="tema-secim"
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
                  className="tema-secim"
                  required
                  value={kayitSoyad}
                  onChange={(e) => setKayitSoyad(e.target.value)}
                  placeholder="Soyadın"
                  maxLength={40}
                />
              </div>
            </div>
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
              <span>E-posta</span>
              <input
                className="tema-secim"
                type="email"
                autoComplete="email"
                required
                value={kayitEposta}
                onChange={(e) => setKayitEposta(e.target.value)}
                placeholder="ornek@okul.edu.tr"
              />
            </div>
            <div className="alan">
              <span>Şifre <span className="not">(en az 8 karakter)</span></span>
              <input
                className="tema-secim"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={kayitSifre}
                onChange={(e) => setKayitSifre(e.target.value)}
                placeholder="••••••••"
              />
            </div>
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
