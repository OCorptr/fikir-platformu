// /bakanlik, /bakanlik/:periodId, /bakanlik/uygulamalar — Bakanlık paneli (admin temalı).
// Ministry session yoksa anasayfaya yönlendir (popup gösterme).

import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import {
  createPeriod,
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

export function MinistryPage() {
  const { periodId } = useParams<{ periodId?: string }>();
  const navigate = useNavigate();

  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [aktif, setAktif] = useState<Period | null>(null);
  const [adaylar, setAdaylar] = useState<PeriodCandidatesResponse | null>(null);
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

  // Ministry session yoksa anasayfaya yönlendir.
  if (kimlikKontrolEdildi && !ben) {
    return <Navigate to="/" replace />;
  }

  // dönem listesi — periodId yoksa otomatik ilk Open dönem seçilir (URL'ye yazılır)
  const periodlariYenile = () => {
    const controller = new AbortController();
    setYukleniyor(true);
    listPeriods(controller.signal)
      .then((liste) => {
        setPeriods(liste);
        if (!periodId && liste.length > 0) {
          const ilk = liste.find((p) => p.status === "Open") ?? liste[0];
          navigate(`/bakanlik/${ilk.id}`, { replace: true });
        }
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  };

  useEffect(() => {
    if (!ben) return;
    return periodlariYenile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ben]);

  useEffect(() => {
    if (!ben) return;
    if (!periodId) {
      setAktif(null);
      setAdaylar(null);
      setSecilmis(null);
      return;
    }
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    Promise.all([
      listPeriods(controller.signal).then((liste) => {
        const bulunan = liste.find((p) => p.id === periodId) ?? null;
        setAktif(bulunan);
      }),
      getPeriodCandidates(periodId, controller.signal).then(setAdaylar),
      getPeriodSelected(periodId, controller.signal).then(setSecilmis),
      getImplementationSummary(controller.signal).then(setUygulamalar),
    ])
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben, periodId]);

  async function secimYap(categoryId: number, ideaId: string) {
    if (!aktif) return;
    setHata(null);
    try {
      await selectForPeriod(aktif.id, categoryId, ideaId);
      const [a, s] = await Promise.all([
        getPeriodCandidates(aktif.id),
        getPeriodSelected(aktif.id),
      ]);
      setAdaylar(a);
      setSecilmis(s);
    } catch (e) { setHata(mesajCikar(e)); }
  }

  const baslik = "Dönemler & Aday Havuzu";
  const aciklama = "Her üç aylık dönemde, tüm kategorilerden birer il onaylı fikir seçilir (plan §26)";

  return (
    <AdminLayout
      ben={ben}
      baslik={baslik}
      aciklama={aciklama}
      donemRozet={aktif ? `📅 ${donemRozet(aktif)}` : undefined}
    >
      {!kimlikKontrolEdildi && (
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
      )}

      {kimlikKontrolEdildi && ben && (
        <>
          <div className="istatistikler" style={{ marginBottom: "1rem" }}>
            <div className="istat">
              <span className="ikon turkuaz">📅</span>
              <div><div className="sayi">{periods.length}</div><div className="istat-etiket">Dönem</div></div>
            </div>
            <div className="istat">
              <span className="ikon sari">📋</span>
              <div><div className="sayi">{adaylar?.categories.length ?? 0}</div><div className="istat-etiket">Kategori</div></div>
            </div>
            <div className="istat">
              <span className="ikon yesil">✅</span>
              <div><div className="sayi">{secilmis?.selections.length ?? 0}</div><div className="istat-etiket">Seçilen Fikir</div></div>
            </div>
            <div className="istat">
              <span className="ikon mavi">🔒</span>
              <div><div className="sayi">{adaylar?.categories.reduce((n, c) => n + c.ideas.filter((i) => i.isLocked).length, 0) ?? 0}</div><div className="istat-etiket">Locked Havuz</div></div>
            </div>
          </div>

          <section className="tablo-kart" style={{ marginBottom: "1.2rem" }}>
            <div className="tablo-araclar" style={{ flexWrap: "wrap" }}>
              {periods.length > 0 && (
                <select
                  className="secim-kutu"
                  value={aktif?.id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    window.history.pushState({}, "", id ? `/bakanlik/${id}` : "/bakanlik");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                >
                  <option value="">Dönem seç…</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {donemEtiketi(p)} [{PERIOD_STATUS_LABELS[p.status]}]
                    </option>
                  ))}
                </select>
              )}
            </div>

            {hata && (
              <div className="status-banner status-banner--error" role="alert" style={{ marginBottom: "0.8rem" }}>
                <span className="status-banner__icon">!</span><span>{hata}</span>
              </div>
            )}

            {!aktif && (
              <div className="il-panel-bos"><p>Henüz aktif dönem yok. Dönemler 3 ayda bir otomatik oluşturulur.</p></div>
            )}

            {aktif && (
              <div style={{ marginBottom: "0.4rem", fontWeight: 800, color: "var(--lacivert)", fontSize: "1.05rem" }}>
                {donemEtiketi(aktif)}
                <span className="durum" style={{ marginLeft: "0.6rem", background: aktif.status === "Open" ? "#E7F6EC" : "#FDEBD8", color: aktif.status === "Open" ? "#2E7D46" : "#B26A05" }}>
                  {aktif.status === "Open" ? "🟢 Açık" : PERIOD_STATUS_LABELS[aktif.status]}
                </span>
              </div>
            )}

            {aktif && adaylar && (
              <div>
                {adaylar.categories.map((g) => {
                  const emoji = KATEGORI_EMOJI[g.categoryName] ?? "💡";
                  return (
                    <div key={g.categoryId} style={{ marginBottom: "1.4rem" }}>
                      <div className="bolum-basligi turuncu">
                        {emoji} {g.categoryName} · {g.ideas.length} aday{g.selected ? " · kategori seçildi" : ""}
                      </div>
                      {g.ideas.length === 0 ? (
                        <div className="il-panel-bos" style={{ marginTop: "0.5rem" }}>
                          <p>📭 Bu kategoride aday fikir bulunmuyor.</p>
                          <p className="meta">Eşiği (3.5) geçen fikirler otomatik aday olur.</p>
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
                                <span className="durum altin">⭐ Bu Dönemin Fikri</span>
                              ) : g.selected ? (
                                <span className="meta">kategori seçildi</span>
                              ) : (
                                <span className="durum yesil">✓ Aday</span>
                              )}
                              {!g.selected && (
                                <button
                                  type="button"
                                  className="btn-ana btn-aday"
                                  onClick={() => secimYap(g.categoryId, i.id)}
                                  disabled={aktif.status !== "Open"}
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
                })}
              </div>
            )}
          </section>

          {aktif && secilmis && secilmis.selections.length > 0 && (
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
    </AdminLayout>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
