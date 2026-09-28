// Şifre Sıfırlama sayfası — Sprint 11.17 yeniden tasarım.
//
// URL: /sifre-sifirla?token=...&userId=...   (Admin Panel'den)
//   veya: /sifre-sifirla?token=...&email=... (forgot-password akışı)
//
// Onur feedback: "userId göstermek kötü, email + isim göster. Form özenli olsun."
//
// Mount'ta /api/auth/reset-password-info ile user bilgisi çekilir.
// Şifre input'ları: autocomplete, password toggle, strength göstergesi.

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { sifreKurallaraUyuyor, sifreKuralHatasi } from "../services/sifreKurallari";
import { apiRequest, ApiHttpError } from "../services/api";

interface ResetInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function SifreSifirlaPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const userId = params.get("userId") ?? "";
  const emailParam = params.get("email") ?? "";

  const [info, setInfo] = useState<ResetInfo | null>(null);
  const [infoHatasi, setInfoHatasi] = useState<string | null>(null);

  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [basarili, setBasarili] = useState(false);
  const [sifreGorunur, setSifreGorunur] = useState(false);

  const urlDolu = token.length > 0 && (userId.length > 0 || emailParam.length > 0);

  // Kullanıcı bilgisini çek (sayfa mount'ında).
  useEffect(() => {
    if (!urlDolu) return;
    const ctrl = new AbortController();
    const qs = userId ? `userId=${encodeURIComponent(userId)}` : `email=${encodeURIComponent(emailParam)}`;
    apiRequest<ResetInfo>(`/api/auth/reset-password-info?${qs}`, { signal: ctrl.signal })
      .then(setInfo)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setInfoHatasi("Kullanıcı bilgisi alınamadı. Bağlantı geçersiz olabilir.");
        }
      });
    return () => ctrl.abort();
  }, [urlDolu, userId, emailParam]);

  // Şifre güç göstergesi (heuristik).
  const sifreGucu = useMemo(() => {
    if (yeniSifre.length === 0) return { seviye: 0, etiket: "" };
    let puan = 0;
    if (yeniSifre.length >= 8) puan++;
    if (yeniSifre.length >= 12) puan++;
    if (/[A-Z]/.test(yeniSifre)) puan++;
    if (/[a-z]/.test(yeniSifre)) puan++;
    if (/\d/.test(yeniSifre)) puan++;
    if (/[^A-Za-z0-9]/.test(yeniSifre)) puan++;
    const seviye = Math.min(4, Math.floor(puan / 1.5));
    const etiket =
      seviye <= 1 ? "Zayıf" :
      seviye === 2 ? "Orta" :
      seviye === 3 ? "İyi" : "Güçlü";
    return { seviye, etiket };
  }, [yeniSifre]);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    setHata(null);

    if (yeniSifre !== yeniSifreTekrar) {
      setHata("Yeni şifre ve tekrarı eşleşmiyor.");
      return;
    }
    // Sprint 11.53: YEĞİTEK madde 16 — kurallar backend ile birebir aynı.
    const kuralHatasi = sifreKuralHatasi(yeniSifre);
    if (kuralHatasi) {
      setHata(kuralHatasi);
      return;
    }

    setCalisiyor(true);
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: {
          userId: userId.trim() || undefined,
          email: emailParam.trim() || undefined,
          token,
          newPassword: yeniSifre,
        },
      });
      setBasarili(true);
    } catch (err) {
      setHata(
        err instanceof ApiHttpError
          ? err.message
          : "Şifre sıfırlanamadı. Bağlantınızın süresi dolmuş olabilir.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  // URL bozuk.
  if (!urlDolu) {
    return (
      <main className="sayfa-sifre-sifirla">
        <section className="ss-kart ss-hata" aria-labelledby="ss-hatasi">
          <div className="ss-ikon" aria-hidden="true">⚠️</div>
          <h2 id="ss-hatasi">Geçersiz Şifre Sıfırlama Bağlantısı</h2>
          <p className="ss-alt">Bu bağlantı geçersiz veya süresi dolmuş.</p>
          <div className="ss-aksiyonlar">
            <Link to="/sifremi-unuttum" className="btn btn-primary">
              Yeni sıfırlama bağlantısı isteyin
            </Link>
            <Link to="/giris" className="btn btn-ghost">← Giriş ekranına dön</Link>
          </div>
        </section>
      </main>
    );
  }

  const avatarBasHarf = info
    ? `${info.firstName?.[0] ?? ""}${info.lastName?.[0] ?? ""}`.toUpperCase() || "?"
    : "…";
  const tamIsim = info ? `${info.firstName} ${info.lastName}`.trim() : "";

  return (
    <main className="sayfa-sifre-sifirla">
      <section className="ss-kart" aria-labelledby="ss-baslik">
        <div className="ss-baslik-alani">
          <h2 id="ss-baslik">Şifre Sıfırlama</h2>
          <p className="ss-alt">
            Hesabınız için yeni şifre belirleyin.
          </p>
        </div>

        <div className="ss-kullanici-bilgi">
          <div className="ss-avatar" aria-hidden="true">
            {info ? avatarBasHarf : "…"}
          </div>
          <div className="ss-kullanici-metin">
            <strong className="ss-kullanici-isim">
              {info ? tamIsim || info.email : "Yükleniyor…"}
            </strong>
            {info && (
              <span className="ss-kullanici-eposta">{info.email}</span>
            )}
            {infoHatasi && (
              <span className="ss-kullanici-hata">{infoHatasi}</span>
            )}
          </div>
        </div>

        {basarili ? (
          <div className="ss-basarili" role="status" aria-live="polite">
            <div className="ss-ikon" aria-hidden="true">✓</div>
            <h3>Şifreniz başarıyla sıfırlandı</h3>
            <p>Yeni şifrenizle giriş yapabilirsiniz.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/giris")}
            >
              Giriş ekranına git
            </button>
          </div>
        ) : (
          <>
            {hata && <div className="ss-hata-mesaj" role="alert">{hata}</div>}

            <form onSubmit={gonder} className="ss-form">
              <label className="ss-alan">
                <span className="ss-etiket">Yeni Şifre</span>
                <div className="ss-input-sarmal">
                  <input
                    type={sifreGorunur ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    spellCheck={false}
                    value={yeniSifre}
                    onChange={(e) => setYeniSifre(e.target.value)}
                    placeholder="En az 8 karakter"
                    disabled={calisiyor}
                    aria-describedby="ss-guc"
                  />
                  <button
                    type="button"
                    className="ss-input-toggle"
                    onClick={() => setSifreGorunur((v) => !v)}
                    aria-label={sifreGorunur ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {sifreGorunur ? "🙈" : "👁"}
                  </button>
                </div>
                {yeniSifre.length > 0 && (
                  <div className="ss-guc" id="ss-guc" aria-live="polite">
                    <div className={`ss-guc-cubuk ss-guc-${sifreGucu.seviye}`}>
                      <span /><span /><span /><span />
                    </div>
                    <span className="ss-guc-etiket">{sifreGucu.etiket}</span>
                  </div>
                )}
              </label>

              <label className="ss-alan">
                <span className="ss-etiket">Yeni Şifre Tekrar</span>
                <input
                  type={sifreGorunur ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={yeniSifreTekrar}
                  onChange={(e) => setYeniSifreTekrar(e.target.value)}
                  placeholder="Aynı şifreyi tekrar girin"
                  disabled={calisiyor}
                  className={
                    yeniSifreTekrar.length > 0 && yeniSifreTekrar !== yeniSifre
                      ? "ss-input-uyumsuz"
                      : ""
                  }
                />
                {yeniSifreTekrar.length > 0 && yeniSifreTekrar !== yeniSifre && (
                  <span className="ss-uyari">Şifreler eşleşmiyor.</span>
                )}
              </label>

              <button
                type="submit"
                className="btn btn-primary ss-btn-gonder"
                disabled={calisiyor}
              >
                {calisiyor ? "Sıfırlanıyor…" : "Şifreyi Sıfırla"}
              </button>
            </form>

            <p className="ss-yardim">
              Sorun mu var?{" "}
              <Link to="/sifremi-unuttum">Yeni bağlantı iste</Link>
              {" · "}
              <Link to="/giris">Giriş ekranına dön</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
