// /bakanlik, /bakanlik/donemler — Bakanlık paneli (admin temalı).
// Sidebar'dan 2 ayrı menü öğesi ile erişilir: "Aktif Adaylar" + "Dönemler".
// gorunum prop'u route'tan gelir; sekme state yoktur.
// Ministry session yoksa anasayfaya yönlendirir.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import {
  getPeriodCandidates,
  getPeriodSelected,
  listPeriods,
  selectForPeriod,
} from "../services/ministry";
import { getImplementationSummary } from "../services/implementations";
import {
  donemEtiketi,
  donemRozet,
  IMPLEMENTATION_LABELS,
  type ImplementationSummary,
  type MeSession,
  PERIOD_STATUS_LABELS,
  type Period,
  type PeriodCandidatesResponse,
  type PeriodSelectedResponse,
  sessionForContext,
} from "../types";

const KATEGORI_EMOJI: Record<string, string> = {
  "Kültür ve Sanat": "🎨",
  "Spor ve Sağlıklı Yaşam": "⚽",
  "Bilim ve Teknoloji": "🔬",
  "Çevre ve Sürdürülebilirlik": "🌱",
  "Yapay Zekâ": "🤖",
  "Girişimcilik": "💡",
  "Değerler Eğitimi": "📖",
  "Sosyal Sorumluluk": "🤝",
};

export type MinistryGorunum = "adaylar" | "donemler";

interface MinistryPageProps {
  gorunum: MinistryGorunum;
}

export function MinistryPage({ gorunum }: MinistryPageProps) {
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);

  const [periods, setPeriods] = useState<Period[]>([]);
  // Aktif Adaylar için otomatik seçilen Open dönem
  const [aktifDonem, setAktifDonem] = useState<Period | null>(null);
  const [adaylar, setAdaylar] = useState<PeriodCandidatesResponse | null>(null);

  // Dönemler sekmesinde kullanıcının seçtiği dönem (URL'e yazılmaz, state'te tutulur)
  const [seciliPeriodId, setSeciliPeriodId] = useState<string | null>(null);
  const [secilmis, setSecilmis] = useState<PeriodSelectedResponse | null>(null);
  const [uygulamalar, setUygulamalar] = useState<ImplementationSummary[]>([]);

  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => setBen(sessionForContext(c, "ministry")))
      .catch(() => setBen(null))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // Dönem listesi + ilk Open dönem
  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    setYukleniyor(true);
    listPeriods(controller.signal)
      .then((liste) => {
        setPeriods(liste);
        const ilk = liste.find((p) => p.status === "Open") ?? liste[0] ?? null;
        setAktifDonem(ilk);
        setSeciliPeriodId((prev) => prev ?? ilk?.id ?? null);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben]);

  // Aktif Adaylar görünümü: aktif dönem adaylarını çek
  useEffect(() => {
    if (!ben || gorunum !== "adaylar" || !aktifDonem) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    getPeriodCandidates(aktifDonem.id, controller.signal)
      .then(setAdaylar)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben, gorunum, aktifDonem]);

  // Dönemler görünümü: seçilen dönem için aday + seçilen + uygulamalar
  useEffect(() => {
    if (!ben || gorunum !== "donemler" || !seciliPeriodId) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    Promise.all([
      getPeriodCandidates(seciliPeriodId, controller.signal).then(setAdaylar),
      getPeriodSelected(seciliPeriodId, controller.signal).then(setSecilmis),
      getImplementationSummary(controller.signal).then(setUygulamalar),
    ])
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben, gorunum, seciliPeriodId]);

  if (kimlikKontrolEdildi && !ben) {
    return <Navigate to="/" replace />;
  }

  async function secimYap(categoryId: number, ideaId: string) {
    const hedef = gorunum === "adaylar"
      ? aktifDonem
      : periods.find((p) => p.id === seciliPeriodId) ?? null;
    if (!hedef) return;
    setHata(null);
    try {
      await selectForPeriod(hedef.id, categoryId, ideaId);
      const [a, s] = await Promise.all([
        getPeriodCandidates(hedef.id),
        getPeriodSelected(hedef.id),
      ]);
      setAdaylar(a);
      setSecilmis(s);
    } catch (e) { setHata(mesajCikar(e)); }
  }

  const baslik = gorunum === "adaylar" ? "Aktif Adaylar" : "Dönemler";
  const rozetDonem = gorunum === "adaylar"
    ? aktifDonem
    : periods.find((x) => x.id === seciliPeriodId) ?? null;

  // Ortak: aday kartları bloğu (kategori başına)
  const adayKartlari = (kilitli: boolean) => {
    if (!adaylar) return null;
    return adaylar.categories.map((g) => {
      const emoji = KATEGORI_EMOJI[g.categoryName] ?? "💡";
      const hedef = rozetDonem;
      return (
        <div key={g.categoryId} style={{ marginBottom: "1.4rem" }}>
          <div className="bolum-basligi turuncu">
            {emoji} {g.categoryName} · {g.ideas.length} aday{g.selected ? " · kategori seçildi" : ""}
          </div>
          {g.ideas.length === 0 ? (
            <div className="il-panel-bos" style={{ marginTop: "0.5rem" }}>
              <p>📭 Bu kategoride aday fikir bulunmuyor.</p>
              {gorunum === "adaylar" && (
                <p className="meta">Eşiği (3.5) geçen fikirler otomatik aday olur.</p>
              )}
            </div>
          ) : (
            <div className="adaylar">
              {g.ideas.map((i) => (
                <div
                  key={i.id}
                  className={`aday-kart ${i.isSelected ? "secili" : ""} ${g.selected && !i.isSelected ? "soluk" : ""}`}
                >
                  <div className="aday-emoji">{emoji}</div>
                  <h3>{i.provinceName}</h3>
                  <div className="okul">📅 {new Date(i.updatedAt).toLocaleDateString("tr-TR")}</div>
                  <div className="fikir-alinti">&ldquo;{i.content || "(boş)"}&rdquo;</div>
                  {i.isSelected ? (
                    <span className="durum altin">👑 Ayın Fikri</span>
                  ) : g.selected ? (
                    <span className="meta">kategori seçildi</span>
                  ) : (
                    <span className="durum yesil">🌟 Aday</span>
                  )}
                  {!g.selected && (
                    <button
                      type="button"
                      className="btn-ana btn-aday"
                      onClick={() => secimYap(g.categoryId, i.id)}
                      disabled={!hedef || hedef.status !== "Open"}
                    >
                      👑 Ayın Fikri Seç
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <AdminLayout ben={ben} baslik={baslik} donemRozet={rozetDonem ? `📅 ${donemRozet(rozetDonem)}` : undefined}>
      {!kimlikKontrolEdildi && (
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
      )}

      {kimlikKontrolEdildi && ben && (
        <>
          {hata && (
            <div className="status-banner status-banner--error" role="alert" style={{ marginBottom: "0.8rem" }}>
              <span className="status-banner__icon">!</span><span>{hata}</span>
            </div>
          )}

          {/* ===== AKTİF ADAYLAR GÖRÜNÜMÜ ===== */}
          {gorunum === "adaylar" && (
            <>
              {!aktifDonem ? (
                <div className="il-panel-bos"><p>Henüz aktif dönem yok.</p></div>
              ) : (
                <section className="tablo-kart" style={{ marginBottom: "1.2rem" }}>
                  <div style={{ marginBottom: "0.6rem", fontWeight: 800, color: "var(--lacivert)", fontSize: "1.05rem" }}>
                    {donemEtiketi(aktifDonem)}
                    <span className="durum yesil" style={{ marginLeft: "0.6rem" }}>
                      {aktifDonem.status === "Open" ? "🟢 Açık" : PERIOD_STATUS_LABELS[aktifDonem.status]}
                    </span>
                  </div>
                  {yukleniyor && !adaylar && (
                    <div className="status-banner status-banner--info">
                      <span className="status-banner__icon">i</span><span>Adaylar yükleniyor…</span>
                    </div>
                  )}
                  {adaylar && adayKartlari(false)}
                </section>
              )}
            </>
          )}

          {/* ===== DÖNEMLER GÖRÜNÜMÜ ===== */}
          {gorunum === "donemler" && (
            <>
              <section className="tablo-kart" style={{ marginBottom: "1.2rem" }}>
                <div className="tablo-araclar" style={{ flexWrap: "wrap" }}>
                  {periods.length > 0 && (
                    <select
                      className="secim-kutu"
                      value={seciliPeriodId ?? ""}
                      onChange={(e) => setSeciliPeriodId(e.target.value || null)}
                    >
                      {periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {donemEtiketi(p)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {(() => {
                  const p = periods.find((x) => x.id === seciliPeriodId);
                  if (!p) return null;
                  return (
                    <div style={{ marginBottom: "0.4rem", fontWeight: 800, color: "var(--lacivert)", fontSize: "1.05rem" }}>
                      {donemEtiketi(p)}
                      <span className="durum yesil" style={{ marginLeft: "0.6rem" }}>
                        {p.status === "Open" ? "🟢 Açık" : PERIOD_STATUS_LABELS[p.status]}
                      </span>
                    </div>
                  );
                })()}

                {adaylar && adayKartlari(true)}
              </section>

              {secilmis && secilmis.selections.length > 0 && (
                <section className="tablo-kart" style={{ marginBottom: "1.2rem" }}>
                  <div className="bolum-basligi turkuaz">📌 Bu Dönemde Seçilenler ({secilmis.selections.length})</div>
                  <div className="tablo-sarmal">
                    <table className="tablo">
                      <thead>
                        <tr><th>Kategori</th><th>İl</th><th>İçerik</th><th>Seçim Tarihi</th></tr>
                      </thead>
                      <tbody>
                        {secilmis.selections.map((s) => (
                          <tr key={s.CategoryId}>
                            <td><strong>Kategori #{s.CategoryId}</strong></td>
                            <td>{s.Idea?.provinceName ?? "—"}</td>
                            <td className="fikir-hucre"><div className="icerik-ozet">{s.Idea?.content || <i>(boş)</i>}</div></td>
                            <td><span className="meta">{new Date(s.SelectedAt).toLocaleDateString("tr-TR")}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {uygulamalar.length > 0 && (
                <section className="tablo-kart">
                  <div className="bolum-basligi turuncu">🚀 Uygulama Takibi (tüm dönemler · {uygulamalar.length})</div>
                  <div className="tablo-sarmal">
                    <table className="tablo">
                      <thead>
                        <tr><th>Dönem</th><th>Durum</th><th>Kategori</th><th>İl</th><th>İçerik</th></tr>
                      </thead>
                      <tbody>
                        {uygulamalar.map((u) => {
                          const status = u.status.Status as keyof typeof IMPLEMENTATION_LABELS;
                          const cls = u.status.Status === "Completed" ? "yesil"
                            : u.status.Status === "Failed" ? "turuncu"
                            : u.status.Status === "InProgress" ? "mavi"
                            : "altin";
                          return (
                            <tr key={u.ideaId}>
                              <td><span className="meta">{u.status.PeriodLabel}</span></td>
                              <td><span className={`durum ${cls}`}>{IMPLEMENTATION_LABELS[status] ?? u.status.Status}</span></td>
                              <td><strong>{u.categoryName}</strong></td>
                              <td>{u.provinceName}</td>
                              <td className="fikir-hucre"><div className="icerik-ozet">{u.content || <i>(boş)</i>}</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
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
