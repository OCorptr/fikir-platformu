// /bakanlik — Bakanlık paneli (Aşama 6). Yalnız MinistryOfficial.

import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import {
  createPeriod,
  getPeriodCandidates,
  getPeriodSelected,
  listPeriods,
  selectForPeriod,
} from "../services/ministry";
import type {
  MeAuthenticated,
  Period,
  PeriodCandidatesResponse,
  PeriodSelectedResponse,
} from "../types";

export function MinistryPage() {
  const { periodId } = useParams<{ periodId?: string }>();
  const [ben, setBen] = useState<MeAuthenticated | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [aktif, setAktif] = useState<Period | null>(null);
  const [adaylar, setAdaylar] = useState<PeriodCandidatesResponse | null>(null);
  const [secilmis, setSecilmis] = useState<PeriodSelectedResponse | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  // /me
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => { if (c.authenticated) setBen(c); else setAuthAcik(true); })
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // dönem listesi
  const periodlariYenile = () => {
    const controller = new AbortController();
    setYukleniyor(true);
    listPeriods(controller.signal)
      .then((liste) => {
        setPeriods(liste);
        if (!periodId && liste.length > 0 && liste[0].status === "Open") {
          setAktif(liste[0]);
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

  // periodId değiştiğinde detayları çek
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
    ])
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben, periodId]);

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

  async function yeniDonem() {
    setHata(null);
    try {
      const period = await createPeriod();
      setPeriods((p) => [period, ...p]);
      setAktif(period);
      window.history.pushState({}, "", `/bakanlik/${period.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (e) {
      setHata(mesajCikar(e));
    }
  }

  async function secimYap(categoryId: number, ideaId: string) {
    if (!aktif) return;
    setHata(null);
    try {
      await selectForPeriod(aktif.id, categoryId, ideaId);
      // adayları + seçilenleri yenile
      const [a, s] = await Promise.all([
        getPeriodCandidates(aktif.id),
        getPeriodSelected(aktif.id),
      ]);
      setAdaylar(a);
      setSecilmis(s);
    } catch (e) {
      setHata(mesajCikar(e));
    }
  }

  if (!kimlikKontrolEdildi) {
    return (
      <main className="fikir-hero">
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} sadeceGiris />
      </main>
    );
  }

  const ministryMi = ben?.roles.includes("MinistryOfficial") ?? false;
  if (ben && !ministryMi) return <Navigate to="/" replace />;

  return (
    <main className="il-panel-hero">
      <section className={`fikir-karti ${authAcik ? "fikir-form-blur" : ""}`} style={{ maxWidth: "80rem" }}>
        <h1>
          <span style={{ color: "#1f9fa4" }}>Bakanlık</span>{" "}
          <span style={{ color: "#ef7814" }}>Paneli</span>
        </h1>
        <p className="il-panel-ozet">
          Her üç aylık dönemde, tüm kategorilerden birer il onaylı fikir seçilir (plan §26).
        </p>

        {hata && (
          <div className="status-banner status-banner--error" role="alert">
            <span className="status-banner__icon">!</span><span>{hata}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
          <button type="button" className="btn-ana" onClick={yeniDonem} disabled={yukleniyor}>
            📅 Yeni Dönem Oluştur
          </button>
          {periods.length > 0 && (
            <select
              className="tema-secim"
              style={{ maxWidth: "20rem" }}
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
                  {p.label} ({new Date(p.startAt).toLocaleDateString("tr-TR")} – {new Date(p.endAt).toLocaleDateString("tr-TR")}) [{p.status}]
                </option>
              ))}
            </select>
          )}
        </div>

        {!aktif && (
          <div className="il-panel-bos">
            <p>Henüz dönem yok. "Yeni Dönem Oluştur" ile başla.</p>
          </div>
        )}

        {aktif && adaylar && (
          <>
            <div className="bolum-basligi turuncu">Aday Havuzu (kategoriye göre)</div>
            <table className="il-panel-tablo">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>İl</th>
                  <th>İçerik</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {adaylar.categories.flatMap((g) =>
                  g.ideas.map((i) => (
                    <tr key={i.id} className={i.isSelected ? "okunmamis" : ""}>
                      <td><strong>{g.categoryName}</strong></td>
                      <td>{i.provinceName}</td>
                      <td className="icerik-hucre">
                        <div className="icerik-ozet">{i.content || <i>(boş)</i>}</div>
                      </td>
                      <td>
                        {g.selected && i.isSelected ? (
                          <span className="taslak-durum taslak-durum--Submitted">Seçildi ✓</span>
                        ) : g.selected ? (
                          <span className="meta">kategori seçildi</span>
                        ) : (
                          <button
                            type="button"
                            className="taslak-islem"
                            onClick={() => secimYap(g.categoryId, i.id)}
                          >
                            Seç
                          </button>
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </>
        )}

        {aktif && secilmis && secilmis.selections.length > 0 && (
          <>
            <div className="bolum-basligi turkuaz" style={{ marginTop: "1.4rem" }}>Bu Dönemde Seçilenler</div>
            <table className="il-panel-tablo">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>İl</th>
                  <th>İçerik</th>
                  <th>Seçim</th>
                </tr>
              </thead>
              <tbody>
                {secilmis.selections.map((s) => (
                  <tr key={s.CategoryId}>
                    <td><strong>Kategori #{s.CategoryId}</strong></td>
                    <td>{s.Idea?.provinceName ?? "—"}</td>
                    <td className="icerik-hucre">
                      <div className="icerik-ozet">{s.Idea?.content || <i>(boş)</i>}</div>
                    </td>
                    <td>
                      <span className="meta">{new Date(s.SelectedAt).toLocaleDateString("tr-TR")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
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
