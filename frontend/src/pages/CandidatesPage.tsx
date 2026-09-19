// /il-panel/adaylar — aday havuzu (Aşama 5), yalnız ProvinceManager.

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { getCandidates } from "../services/province";
import type { CandidateSummary, MeAuthenticated } from "../types";

export function CandidatesPage() {
  const [ben, setBen] = useState<MeAuthenticated | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);

  const [adaylar, setAdaylar] = useState<CandidateSummary[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => { if (c.authenticated) setBen(c); else setAuthAcik(true); })
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    getCandidates(controller.signal)
      .then(setAdaylar)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben]);

  function authGuncelle() {
    setAuthAcik(false);
    setKimlikKontrolEdildi(false);
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => setBen(c.authenticated ? c : null))
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }

  if (!kimlikKontrolEdildi) {
    return (
      <main className="fikir-hero">
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} sadeceGiris />
      </main>
    );
  }

  const managerMi = ben?.roles.includes("ProvinceManager") ?? false;
  if (ben && !managerMi) return <Navigate to="/il-panel" replace />;

  return (
    <main className="il-panel-hero">
      <section className={`fikir-karti ${authAcik ? "fikir-form-blur" : ""}`}>
        <button type="button" className="btn-ikincil" onClick={() => navigate("/il-panel")}>
          ← Gelen kutusuna dön
        </button>

        <h1>
          <span style={{ color: "#1f9fa4" }}>Aday</span>{" "}
          <span style={{ color: "#ef7814" }}>Havuzu</span>
        </h1>
        <p className="il-panel-ozet">
          Ortalama puanı <strong>3.5</strong> eşiğini geçen ve değerlendirmesi tamamlanan fikirler
          otomatik burada görünür.
        </p>

        {hata && (
          <div className="status-banner status-banner--error" role="alert">
            <span className="status-banner__icon">!</span><span>{hata}</span>
          </div>
        )}

        {yukleniyor && <p>Yükleniyor…</p>}

        {!yukleniyor && adaylar.length === 0 && (
          <div className="il-panel-bos">
            <p>📭 Şu an aday havuzunda fikir bulunmuyor.</p>
          </div>
        )}

        {adaylar.length > 0 && (
          <table className="il-panel-tablo">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Ortalama Puan</th>
                <th>İçerik</th>
                <th>Tamamlanma</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {adaylar.map((a) => (
                <tr key={a.ideaId}>
                  <td><strong>{a.categoryName}</strong></td>
                  <td><span className="kriter-ortalama">{a.averageScore.toFixed(2)}</span></td>
                  <td className="icerik-hucre">
                    <div className="icerik-ozet">{a.content || <i>(boş)</i>}</div>
                  </td>
                  <td>
                    <span className="meta">
                      {new Date(a.completedAt).toLocaleDateString("tr-TR")}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="taslak-islem"
                      onClick={() => navigate(`/il-panel/fikir/${a.ideaId}`)}
                    >
                      Aç
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AuthModal acik={authAcik} onAuthed={authGuncelle} sadeceGiris />
    </main>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
