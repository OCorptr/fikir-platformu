// /il-panel/adaylar — aday havuzu (admin temalı).
// ProvinceManager rolü yoksa anasayfaya yönlendir (popup gösterme).

import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { getCandidates, approveIdea } from "../services/province";
import { ilYoneticiMi } from "../components/YetkiliPanelSecim";
import { type CandidateSummary, type MeSession, sessionForContext } from "../types";

const EMOJI: Record<string, string> = {
  "Kültür ve Sanat": "🎨",
  "Spor ve Sağlıklı Yaşam": "⚽",
  "Bilim ve Teknoloji": "🔬",
  "Çevre ve Sürdürülebilirlik": "🌱",
  "Yapay Zekâ": "🤖",
  "Girişimcilik": "💡",
  "Değerler Eğitimi": "📖",
  "Sosyal Sorumluluk": "🤝",
};

export function CandidatesPage() {
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);

  const [adaylar, setAdaylar] = useState<CandidateSummary[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  // Sprint 11.92 (Onur): "İl onayı Aday Havuzu sayfasında yapılacak."
  // Detay sayfasındaki "İl Onayı Ver" butonu kaldırıldı; onay buradan.
  const [onaylananId, setOnaylananId] = useState<string | null>(null);
  const [onayBitis, setOnayBitis] = useState(false);

  async function adayOnayla(aday: CandidateSummary) {
    if (!confirm(
      `“${(aday.content || "").slice(0, 80)}…”\n\nBu fikri il onayıyla kilitleyip bakanlık aday havuzuna göndermek istiyor musun?`,
    )) return;
    setOnayBitis(true);
    setHata(null);
    try {
      await approveIdea(aday.ideaId);
      setOnaylananId(aday.ideaId);
      // Aday havuzunu tazele — onaylanan fikir listeden düşer.
      const taze = await getCandidates();
      setAdaylar(taze);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setOnayBitis(false);
    }
  }

  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => setBen(sessionForContext(c, "province")))
      .catch(() => setBen(null))
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

  // Province session yoksa anasayfaya yönlendir.
  if (kimlikKontrolEdildi && !ben) {
    return <Navigate to="/" replace />;
  }

  // Onur (S11.80): sistem yonetici de il yonetimi yapar (kurum istisnasi).
  // Once yalnizca ProvinceManager kontrol ediliyordu ve sayfa bos ekrana dusuyordu.
  const managerMi = ben ? ilYoneticiMi(ben.roles) : false;
  if (kimlikKontrolEdildi && ben && !managerMi) {
    return <Navigate to="/" replace />;
  }

  const gruplar = useMemo(() => {
    const m = new Map<string, CandidateSummary[]>();
    for (const a of adaylar) {
      const k = a.categoryName;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return Array.from(m.entries());
  }, [adaylar]);

  function emoji(k: string) { return EMOJI[k] ?? "💡"; }

  return (
    <AdminLayout
      ben={ben}
      baslik="Aday Havuzu"
      aciklama="Ortalama puanı 3.5 eşiğini geçen fikirler · il onayı buradan verilir, onaylananlar bakanlığa aday olur"
      donemRozet="📅 2026-2027 · Eylül"
    >
      {!kimlikKontrolEdildi && (
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
      )}

      {kimlikKontrolEdildi && ben && (
        <>
          <div className="bolum-basligi turkuaz" style={{ marginBottom: "1rem" }}>
            ⭐ Adaylar ({adaylar.length})
          </div>

          {hata && (
            <div className="status-banner status-banner--error" role="alert" style={{ marginBottom: "0.8rem" }}>
              <span className="status-banner__icon">!</span><span>{hata}</span>
            </div>
          )}

          {yukleniyor && <div className="status-banner status-banner--info"><span className="status-banner__icon">i</span><span>Adaylar yükleniyor…</span></div>}

          {!yukleniyor && adaylar.length === 0 && (
            <div className="il-panel-bos">
              <p>📭 Şu an aday havuzunda fikir bulunmuyor.</p>
              <p className="meta">Değerlendirme eşiğini (3.5) geçen fikirler buraya otomatik düşer.</p>
            </div>
          )}

          {!yukleniyor && adaylar.length > 0 && gruplar.map(([kat, liste]) => (
            <section key={kat} className="tablo-kart" style={{ marginBottom: "1.2rem" }}>
              <div className="bolum-basligi turuncu">{emoji(kat)} {kat} · {liste.length} aday</div>
              <div className="adaylar" style={{ marginTop: "0.6rem" }}>
                {liste.map((a) => (
                  <div key={a.ideaId} className="aday-kart">
                    <div className="aday-emoji">{emoji(kat)}</div>
                    <h3>{kat}</h3>
                    <div className="okul">Puan: <strong style={{ color: "var(--metin-vurgu)" }}>{a.averageScore.toFixed(2)}</strong> / 5</div>
                    <div className="fikir-alinti">"{a.content || "(boş)"}"</div>
                    <span className="durum yesil">🌟 Aday</span>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-ana btn-aday"
                        onClick={() => adayOnayla(a)}
                        disabled={onayBitis}
                        aria-label={`${a.categoryName} kategorisindeki bu fikre il onayı ver`}
                      >
                        {onayBitis && onaylananId === a.ideaId ? "Onaylanıyor…" : "✅ İl Onayı Ver"}
                      </button>
                      <button type="button" className="btn-ikincil btn-aday" onClick={() => navigate(`/il-panel/fikir/${a.ideaId}`)}>
                        📂 Detayı Aç
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </AdminLayout>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}

