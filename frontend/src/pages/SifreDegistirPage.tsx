// Sprint 11.60 / YG-17 — Zorunlu parola değiştirme ekranı.
//
// Kullanıcı 90 günlük parola süresini doldurduğunda (veya ilk girişte
// MustChangePassword=true ise) uygulamanın geri kalanına erişemez; bu ekrana
// kilitlenir. Sistem yöneticileri muaftır (bkz. SifreYasiPolicy).

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, ApiHttpError } from "../services/api";
import { sifreKuralHatasi, SIFRE_KURALLARI } from "../services/sifreKurallari";

interface Props {
  /** Zorunlu mod: başlık ve uyarı metni değişir, sayfadan çıkılamaz. */
  zorunlu: boolean;
  /** Politika gerekçesi (örn. "Parola yaşı 90 günü aştı"). */
  gerekce?: string | null;
}

export function SifreDegistirPage({ zorunlu, gerekce }: Props) {
  const navigate = useNavigate();
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [yeniTekrar, setYeniTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    setHata(null);

    if (yeni !== yeniTekrar) {
      setHata("Yeni şifre ve tekrarı eşleşmiyor.");
      return;
    }
    const kuralHatasi = sifreKuralHatasi(yeni);
    if (kuralHatasi) {
      setHata(kuralHatasi);
      return;
    }
    if (yeni === mevcut) {
      setHata("Yeni şifre eski şifrenizden farklı olmalıdır.");
      return;
    }

    setCalisiyor(true);
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword: mevcut, newPassword: yeni },
      });
      // Oturum tazelendi; zorunluluk düştüğü için ana sayfaya dön.
      window.location.replace("/");
    } catch (err) {
      setHata(
        err instanceof ApiHttpError
          ? err.message
          : "Şifre değiştirilemedi. Bağlantınızı kontrol edin.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <main className="sayfa-sifre-sifirla">
      <section className="ss-kart" aria-labelledby="sd-baslik">
        <div className="ss-baslik-alani">
          <h2 id="sd-baslik">
            {zorunlu ? "Parolanızın değiştirilmesi gerekiyor" : "Parola değiştir"}
          </h2>
        </div>

        {zorunlu && (
          <div className="ss-uyari" role="alert">
            {gerekce ?? "Parolanızın yaşı 90 günü aştı."} Güvenlik gereksinimi
            (YG-17) uyarınca devam etmek için parolanızı değiştirmeniz gerekiyor.
            <strong> Bu ekrandan çıkılamaz.</strong>
          </div>
        )}

        {hata && (
          <div className="ss-hata-mesaj" role="alert">
            {hata}
          </div>
        )}

        <form onSubmit={gonder} className="ss-form">
          <label className="ss-alan">
            <span className="ss-etiket">Mevcut Parola</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              spellCheck={false}
              value={mevcut}
              onChange={(e) => setMevcut(e.target.value)}
              disabled={calisiyor}
              autoFocus
            />
          </label>

          <label className="ss-alan">
            <span className="ss-etiket">Yeni Parola</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              spellCheck={false}
              value={yeni}
              onChange={(e) => setYeni(e.target.value)}
              disabled={calisiyor}
            />
          </label>

          <label className="ss-alan">
            <span className="ss-etiket">Yeni Parola (Tekrar)</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              spellCheck={false}
              value={yeniTekrar}
              onChange={(e) => setYeniTekrar(e.target.value)}
              disabled={calisiyor}
            />
          </label>

          <ul className="ss-kurallar">
            {SIFRE_KURALLARI.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>

          <button
            type="submit"
            className="btn btn-primary ss-btn-gonder"
            disabled={calisiyor}
          >
            {calisiyor ? "Değiştiriliyor…" : "Parolayı Değiştir"}
          </button>
        </form>

        {!zorunlu && (
          <p className="ss-yardim">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              ← Geri dön
            </button>
          </p>
        )}
      </section>
    </main>
  );
}
