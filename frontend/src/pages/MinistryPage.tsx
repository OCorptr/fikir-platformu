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
  clearPeriodSelection,
  clearPeriodWinner,
  getPeriodCandidates,
  getPeriodSelected,
  listPeriods,
  selectForPeriod,
  selectPeriodWinner,
} from "../services/ministry";
import {
  donemEtiketi,
  donemRozet,
  type MeSession,
  PERIOD_STATUS_LABELS,
  type Period,
  type PeriodCandidatesResponse,
  sessionForContext,
  type SelectedIdea,
} from "../types";
import { ayinFikirleriGetir } from "../services/ayinFikirleri";

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
  // Sprint 11.92: dönemin seçilmiş kategorileri + TEK kazananı.
  const [secililer, setSecililer] = useState<SelectedIdea[]>([]);
  const [kazananFikirId, setKazananFikirId] = useState<string | null>(null);
  const [kazananCalisiyor, setKazananCalisiyor] = useState(false);
  const [secimCalisiyor, setSecimCalisiyor] = useState(false);

  // Dönemler sekmesinde kullanıcının seçtiği dönem (URL'e yazılmaz, state'te tutulur)
  const [seciliPeriodId, setSeciliPeriodId] = useState<string | null>(null);

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
  // Aktif dönem = StartAt <= şimdi < EndAt olan (plan §25: takvime göre aktif).
  // Eşleşme yoksa ilk Open'a düşer.
  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    setYukleniyor(true);
    listPeriods(controller.signal)
      .then((liste) => {
        setPeriods(liste);
        const simdi = Date.now();
        const aktifTarihle = liste.find((p) => {
          const start = new Date(p.startAt).getTime();
          const end = new Date(p.endAt).getTime();
          return p.status === "Open" && start <= simdi && simdi < end;
        });
        const ilk = aktifTarihle ?? liste.find((p) => p.status === "Open") ?? liste[0] ?? null;
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
    secimleriTazele(aktifDonem.id)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    KazananBilgisi(aktifDonem.id, controller.signal);
    return () => controller.abort();
  }, [ben, gorunum, aktifDonem]);

  // Dönemler görünümü: seçilen dönem için adayları çek
  useEffect(() => {
    if (!ben || gorunum !== "donemler" || !seciliPeriodId) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    secimleriTazele(seciliPeriodId)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    KazananBilgisi(seciliPeriodId, controller.signal);
    return () => controller.abort();
  }, [ben, gorunum, seciliPeriodId]);

  /**
   * Sprint 11.92: kazanan bilgisi `/selected` yanıtında YOK (o sadece kategori
   * adaylarını döner). Kazanan `period_winners` tablosundadır ve anonim kamu
   * ucunda yayınlanır — ana sayfanın okuduğu kaynakla aynı kaynaktan okuyoruz.
   */
  async function KazananBilgisi(periodId: string, signal?: AbortSignal) {
    try {
      const cevap = await ayinFikirleriGetir(signal);
      setKazananFikirId(cevap.donemler.find((d) => d.id === periodId)?.kazanan?.fikirId ?? null);
    } catch {
      /* kazanan bilgisi kritik değil — aday kartları çalışmaya devam etsin */
    }
  }

  if (kimlikKontrolEdildi && !ben) {
    return <Navigate to="/" replace />;
  }

  /** Seçili dönemin kategori adaylarını ve TEK kazananını tazeler. */
  async function secimleriTazele(periodId: string) {
    const [a, s] = await Promise.all([
      getPeriodCandidates(periodId),
      getPeriodSelected(periodId),
    ]);
    setAdaylar(a);
    setSecililer(s.selections);
    return s;
  }

  async function secimYap(categoryId: number, ideaId: string) {
    const hedef = gorunum === "adaylar"
      ? aktifDonem
      : periods.find((p) => p.id === seciliPeriodId) ?? null;
    if (!hedef) return;
    setHata(null);
    try {
      await selectForPeriod(hedef.id, categoryId, ideaId);
      await secimleriTazele(hedef.id);
    } catch (e) { setHata(mesajCikar(e)); }
  }

  /**
   * Sprint 11.92 — Dönemin kazananını seç (2. kademe).
   * Yalnızca o kategorinin adayı seçilmişse aktif olur; backend de
   * "kazanan, bu dönemin adayları arasından olmalı" diye doğruluyor.
   */
  async function kazananSec(ideaId: string) {
    const hedef = gorunum === "adaylar"
      ? aktifDonem
      : periods.find((p) => p.id === seciliPeriodId) ?? null;
    if (!hedef) return;
    if (!confirm(
      "Bu fikri dönemin TEK kazananı yapmak istiyor musun?\n\n" +
      "Kazanan, herkese açık ana sayfada yayınlanır (öğrenci adı maskeli: \"Elif Y.\" gibi).",
    )) return;

    setKazananCalisiyor(true);
    setHata(null);
    try {
      await selectPeriodWinner(hedef.id, ideaId);
      setKazananFikirId(ideaId);
      await secimleriTazele(hedef.id);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setKazananCalisiyor(false);
    }
  }

  /**
   * Sprint 11.92 — Kazanan seçimini geri al.
   * "Ne olur ne olmaz yanlış tıklandı" senaryosu için.
   * Aday seçimleri (`period_selections`) korunur, sadece kazananlık düşer.
   */
  async function kazananIptal(ideaId: string) {
    const hedef = gorunum === "adaylar"
      ? aktifDonem
      : periods.find((p) => p.id === seciliPeriodId) ?? null;
    if (!hedef) return;
    if (!confirm(
      "Dönemin fikri seçimini geri almak istiyor musun?\n\n" +
      "Ana sayfadaki kart kalkacak. Kategori adayı seçimleri korunur, " +
      "tekrar seçebilirsin.",
    )) return;

    setKazananCalisiyor(true);
    setHata(null);
    try {
      await clearPeriodWinner(hedef.id);
      setKazananFikirId(null);
      await secimleriTazele(hedef.id);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setKazananCalisiyor(false);
    }
  }

  /**
   * Sprint 11.92 — Kategori adayı seçimini geri al ("Ayın Fikri seçmeden önce").
   * Fikir Locked'a döner, yeniden aday olabilir; bu fikir kazandaysa
   * kazananlık da düşer.
   */
  async function kategoriSecimiGeriAl(categoryId: number, ideaId: string) {
    const hedef = gorunum === "adaylar"
      ? aktifDonem
      : periods.find((p) => p.id === seciliPeriodId) ?? null;
    if (!hedef) return;
    if (!confirm(
      "Kategori adayı seçimini geri almak istiyor musun?\n\n" +
      "Fikir il onaylı duruma döner ve yeniden aday olabilir.\n" +
      "Bu fikir dönemin fikriyse, o seçim de düşer.",
    )) return;

    setSecimCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await clearPeriodSelection(hedef.id, categoryId);
      if (sonuc.kazananDuzeltildi) setKazananFikirId(null);
      await secimleriTazele(hedef.id);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setSecimCalisiyor(false);
    }
  }

  const baslik = gorunum === "adaylar" ? "Aktif Adaylar" : "Dönemler";
  const rozetDonem = gorunum === "adaylar"
    ? aktifDonem
    : periods.find((x) => x.id === seciliPeriodId) ?? null;

  // Ortak: tüm aday kartları tek grid'de (kategori başlığı yok — emoji + tema adı kartta)
  const adayKartlari = (_kilitli: boolean) => {
    if (!adaylar) return null;
    const tumKartlar = adaylar.categories.flatMap((g) => {
      const emoji = KATEGORI_EMOJI[g.categoryName] ?? "💡";
      const hedef = rozetDonem;
      return g.ideas.map((i) => ({ g, i, emoji, hedef }));
    });
    if (tumKartlar.length === 0) {
      return (
        <div className="il-panel-bos">
          <p>📭 Bu dönemde aday fikir bulunmuyor.</p>
          {gorunum === "adaylar" && (
            <p className="meta">Eşiği (3.5) geçen fikirler otomatik aday olur.</p>
          )}
        </div>
      );
    }
    return (
      <div className="adaylar">
        {tumKartlar.map(({ g, i, emoji, hedef }) => (
          <div
            key={i.id}
            className={`aday-kart ${i.isSelected ? "secili" : ""} ${g.selected && !i.isSelected ? "soluk" : ""}`}
          >
            <div className="aday-emoji">{emoji}</div>
            <div className="aday-tema">{g.categoryName}</div>
            <h3>{i.provinceName}</h3>
            <div className="okul">📅 {new Date(i.updatedAt).toLocaleDateString("tr-TR")}</div>
            <div className="fikir-alinti">&ldquo;{i.content || "(boş)"}&rdquo;</div>
            {!i.isSelected && <span className="durum yesil">🌟 Aday</span>}
            {i.isSelected && i.id === kazananFikirId && (
              <span className="durum yesil">👑 Dönemin Fikri</span>
            )}

            {/* Sprint 11.92 — İki ayrı buton çünkü iki ayrı kayıt var.
                Önceden tek "👑 Ayın Fikri Seç" butonu vardı ama o YALNIZCA
                `/select`'i çağırıyordu (kategori adayı); `period_winners`
                hiç yazılmadığı için ana sayfa hiçbir şey göstermiyordu. */}
            <div className="aday-eylemler">
              <button
                type="button"
                className={`btn-ana btn-aday ${i.isSelected ? "secildi" : ""}`}
                onClick={() => secimYap(g.categoryId, i.id)}
                disabled={!hedef || hedef.status !== "Open" || g.selected || i.isSelected}
              >
                {i.isSelected
                  ? "✅ Kategori Adayı Seçildi"
                  : g.selected
                    ? "🔒 Kategori Seçildi"
                    : "📌 Kategori Adayı Seç"}
              </button>

              {i.isSelected && (
                i.id === kazananFikirId ? (
                  <button
                    type="button"
                    className="btn-ikincil btn-aday btn-iptal"
                    onClick={() => kazananIptal(i.id)}
                    disabled={kazananCalisiyor || secimCalisiyor}
                    title="Yanlış seçildiyse geri al"
                  >
                    {kazananCalisiyor ? "İptal ediliyor…" : "❌ Seçimi Geri Al"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-ikincil btn-aday"
                    onClick={() => kazananSec(i.id)}
                    disabled={!hedef || hedef.status !== "Open" || kazananCalisiyor || secimCalisiyor}
                    title="Bu dönemin tek kazananı — ana sayfada yayınlanır"
                  >
                    {kazananCalisiyor ? "Seçiliyor…" : "👑 Ayın Fikri Seç"}
                  </button>
                )
              )}

              {/* Sprint 11.92: "Ayın Fikri seçmeden önce" yanlış kategori adayı
                  seçildiyse düzeltme yolu. Kazanan da bu fikir değilse. */}
              {i.isSelected && i.id !== kazananFikirId && (
                <button
                  type="button"
                  className="btn-ikincil btn-aday btn-iptal"
                  onClick={() => kategoriSecimiGeriAl(g.categoryId, i.id)}
                  disabled={kazananCalisiyor || secimCalisiyor}
                  title="Kategori adayı seçimini geri al"
                >
                  {secimCalisiyor ? "Geri alınıyor…" : "↩︎ Aday Seçimini Geri Al"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
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
                  <div style={{ marginBottom: "0.6rem", fontWeight: 800, color: "var(--metin-ana)", fontSize: "1.05rem" }}>
                    {donemEtiketi(aktifDonem)}
                    <span className={`durum ${aktifDonem.status === "Open" ? "yesil" : "turuncu"}`} style={{ marginLeft: "0.6rem" }}>
                      {aktifDonem.status === "Open" ? "🟢 Açık" : `🔒 ${PERIOD_STATUS_LABELS[aktifDonem.status]}`}
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
                    <div style={{ marginBottom: "0.4rem", fontWeight: 800, color: "var(--metin-ana)", fontSize: "1.05rem" }}>
                      {donemEtiketi(p)}
                      <span className={`durum ${p.status === "Open" ? "yesil" : "turuncu"}`} style={{ marginLeft: "0.6rem" }}>
                        {p.status === "Open" ? "🟢 Açık" : `🔒 ${PERIOD_STATUS_LABELS[p.status]}`}
                      </span>
                    </div>
                  );
                })()}

                {adaylar && adayKartlari(true)}
              </section>

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
