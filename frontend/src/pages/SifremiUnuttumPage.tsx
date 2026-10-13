// Şifremi Unuttum sayfası — Sprint 11.5, Sprint 11.93'te yeniden tasarlandı.
//
// Onur feedback (11.93): "çok basit, bizim temaya uygun değil."
// Önceki hâli `auth-modal-kart` class'ını tek başına kullanıyordu — o class
// YALNIZCA `.af-lightbox > .auth-modal-kart` seçicisi altında stillendiği için
// sayfa hiç kural almıyor, çıplak HTML olarak çiziliyordu.
//
// Yeni tasarım iki dili birleştiriyor:
//   · Genel platform teması (sayfa-index gradyanı + Genç AR-GE maskotu +
//     konuşma balonu) — /fikir ekranıyla aynı dil.
//   · ss-* kart dili (SifreSifirlaPage) — şifre akışının iki adımı görünür şekilde
//     aynı ailesye ait olur.
//
// Backend /api/auth/forgot-password'a POST. Yanıt HER ZAMAN aynı generic
// mesajdır (e-posta numaralandırma / enumeration koruması) — bu yüzden "bu
// adres kayıtlı mı" bilgisi arayüze sızmaz.

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest, ApiHttpError } from "../services/api";

export function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    setMesaj(null);
    setHata(null);
    setCalisiyor(true);
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setMesaj(
        "Eğer bu e-posta bir hesaba kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Lütfen e-postanızı (ve spam) klasörünü kontrol edin. Bağlantı 1 saat geçerlidir.",
      );
    } catch (err) {
      setHata(
        err instanceof ApiHttpError
          ? err.message
          : "Şifremi unuttum isteği gönderilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  const gonderildi = mesaj !== null;

  return (
    <main className="sayfa-index sfu-sayfa">
      <div className="sfu-kutu">
        {/* === Sol: maske + konuşma balonu (genel tema dili) === */}
        <div className="sfu-sol">
          <div className="balon-kapsa">
            <div className="balon sfu-balon">
              Şifreni mi unuttun?{" "}
              <b>E-posta adresini</b> yaz, gerisini hallederiz!
            </div>
          </div>
          <img
            className="maskot-fikir"
            src="/assets/img/gencarge_logo.webp"
            alt="Genç AR-GE maskotu"
          />
        </div>

        {/* === Sağ: form kartı === */}
        <section className="ss-kart sfu-kart" aria-labelledby="sifremi-baslik">
          <div className="sfu-ust">
            <div className="sfu-ikon" aria-hidden="true">
              {gonderildi ? "✉️" : "🔑"}
            </div>
            <div>
              <h1 id="sifremi-baslik">Şifremi Unuttum</h1>
              <p className="ss-alt">
                Hesabınıza kayıtlı e-posta adresini girin, sıfırlama
                bağlantısını size ulaştıralım.
              </p>
            </div>
          </div>

          {/* Süreç yol haritası — kullanıcı ne olacağını önceden görür. */}
          <ol className="sfu-adimlar" aria-label="Şifre sıfırlama adımları">
            <li className={gonderildi ? "bitti" : "aktif"}>
              <span className="sfu-adim-no">1</span>
              <span className="sfu-adim-metin">
                <b>E-posta adresinizi yazın</b>
                <small>Hesabınıza kayıtlı adres</small>
              </span>
            </li>
            <li className={gonderildi ? "aktif" : ""}>
              <span className="sfu-adim-no">2</span>
              <span className="sfu-adim-metin">
                <b>Postanızı kontrol edin</b>
                <small>Spam klasörünü de bakın</small>
              </span>
            </li>
            <li>
              <span className="sfu-adim-no">3</span>
              <span className="sfu-adim-metin">
                <b>Yeni şifrenizi belirleyin</b>
                <small>Bağlantı 1 saat geçerli</small>
              </span>
            </li>
          </ol>

          {gonderildi && (
            <div className="sfu-mesaj" role="status" aria-live="polite">
              <span className="sfu-mesaj-ikon" aria-hidden="true">✓</span>
              <p>{mesaj}</p>
            </div>
          )}

          {hata && <div className="ss-hata-mesaj" role="alert">{hata}</div>}

          <form onSubmit={gonder} className="ss-form">
            <label className="ss-alan">
              <span className="ss-etiket">E-POSTA ADRESİNİZ</span>
              <input
                type="email"
                required
                autoComplete="email"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={calisiyor || gonderildi}
                placeholder="ornek@okul.meb.gov.tr"
              />
            </label>
            <button
              type="submit"
              className="btn-ana sfu-btn"
              disabled={calisiyor || gonderildi}
            >
              {calisiyor
                ? "Gönderiliyor…"
                : gonderildi
                  ? "Bağlantı gönderildi ✓"
                  : "Sıfırlama Bağlantısı Gönder"}
            </button>
          </form>

          <p className="sfu-guvenlik">
            <span aria-hidden="true">🔒</span> Güvenliğiniz için, e-posta adresiniz
            kayıtlı olsa da olmasa da <b>her zaman aynı mesajı</b> gösteriyoruz.
          </p>

          <p className="ss-yardim">
            <Link to="/giris">← Giriş ekranına dön</Link>
            {" · "}
            <Link to="/kvkk">Aydınlatma Metni</Link>
          </p>
        </section>
      </div>
    </main>
  );
}