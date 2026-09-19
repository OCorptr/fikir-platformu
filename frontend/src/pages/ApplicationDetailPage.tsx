// /il-panel/fikir/{id} — başvuru detayı (Aşama 4).
// Açılır açılmaz otomatik olarak okundu işaretler; ProvinceManager ise atama modalı açabilir.

import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import {
  approveIdea,
  assignEvaluator,
  getEvaluations,
  getProvinceIdea,
  listEvaluators,
  markRead,
  submitEvaluations,
} from "../services/province";
import {
  CRITERION_LABELS,
  EVALUATION_CRITERIA,
  type EvaluationEntry,
  type IdeaDetailResponse,
  type IdeaEvaluationsResponse,
  type MeAuthenticated,
  type ProvinceEvaluatorRef,
  type SubmitEvaluationItem,
} from "../types";

export function ApplicationDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // kimlik
  const [ben, setBen] = useState<MeAuthenticated | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);

  // veri
  const [detay, setDetay] = useState<IdeaDetailResponse | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  // değerlendirme
  const [evaluations, setEvaluations] = useState<IdeaEvaluationsResponse | null>(null);

  // atama modal
  const [ataAcik, setAtaAcik] = useState(false);
  const [evaluatorler, setEvaluatorler] = useState<ProvinceEvaluatorRef[]>([]);
  const [seciliEvaluator, setSeciliEvaluator] = useState<string>("");
  const [atamaCalisiyor, setAtamaCalisiyor] = useState(false);

  // puanlama modal
  const [puanlamaAcik, setPuanlamaAcik] = useState(false);
  const [puanlar, setPuanlar] = useState<Record<string, { score: number; comment: string }>>(
    Object.fromEntries(EVALUATION_CRITERIA.map((c) => [c, { score: 3, comment: "" }])),
  );
  const [puanlamaCalisiyor, setPuanlamaCalisiyor] = useState(false);

  // onay
  const [onayCalisiyor, setOnayCalisiyor] = useState(false);

  // /me
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => { if (c.authenticated) setBen(c); else setAuthAcik(true); })
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // detay + otomatik okundu + değerlendirmeleri yükle
  useEffect(() => {
    if (!ben || !id) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    (async () => {
      try {
        const d = await getProvinceIdea(id, controller.signal);
        setDetay(d);
        if (!d.readByMe) {
          try {
            await markRead(id);
            setDetay((prev) => prev ? { ...prev, readByMe: true, readAt: new Date().toISOString() } : prev);
          } catch {
            // okundu işaretleme hatası önemsiz
          }
        }
        const ev = await getEvaluations(id, controller.signal);
        setEvaluations(ev);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata(mesajCikar(e));
        }
      } finally {
        setYukleniyor(false);
      }
    })();
    return () => controller.abort();
  }, [ben, id]);

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

  async function ataModalAc() {
    setAtaAcik(true);
    setSeciliEvaluator("");
    if (evaluatorler.length === 0) {
      try {
        const liste = await listEvaluators();
        setEvaluatorler(liste);
      } catch (e) {
        setHata(mesajCikar(e));
      }
    }
  }

  async function ataGonder() {
    if (!seciliEvaluator || !id) return;
    setAtamaCalisiyor(true);
    setHata(null);
    try {
      await assignEvaluator(id, seciliEvaluator);
      // detayı yeniden çek
      const d = await getProvinceIdea(id);
      setDetay(d);
      setAtaAcik(false);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setAtamaCalisiyor(false);
    }
  }

  async function puanlamaGonder() {
    if (!id) return;
    setPuanlamaCalisiyor(true);
    setHata(null);
    try {
      const skorlar: SubmitEvaluationItem[] = EVALUATION_CRITERIA.map((c) => ({
        criterion: c,
        score: puanlar[c].score,
        comment: puanlar[c].comment.trim() ? puanlar[c].comment.trim() : null,
      }));
      await submitEvaluations(id, skorlar);
      const ev = await getEvaluations(id);
      setEvaluations(ev);
      const d = await getProvinceIdea(id);
      setDetay(d);
      setPuanlamaAcik(false);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setPuanlamaCalisiyor(false);
    }
  }

  async function onayla() {
    if (!id) return;
    if (!confirm("Bu fikri onaylayıp kilitlemek istediğine emin misin?")) return;
    setOnayCalisiyor(true);
    setHata(null);
    try {
      await approveIdea(id);
      const d = await getProvinceIdea(id);
      setDetay(d);
    } catch (e) {
      setHata(mesajCikar(e));
    } finally {
      setOnayCalisiyor(false);
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

  const yetkili =
    ben !== null &&
    ben.roles.some((r) => r === "ProvinceEvaluator" || r === "ProvinceManager");
  if (ben && !yetkili) return <Navigate to="/fikir" replace />;

  const managerMi = ben?.roles.includes("ProvinceManager") ?? false;

  return (
    <main className="il-panel-hero">
      <section className={`fikir-karti ${authAcik ? "fikir-form-blur" : ""}`}>
        <button type="button" className="btn-ikincil" onClick={() => navigate("/il-panel")}>
          ← Gelen kutusuna dön
        </button>

        {yukleniyor && <p>Yükleniyor…</p>}

        {hata && (
          <div className="status-banner status-banner--error" role="alert">
            <span className="status-banner__icon">!</span>
            <span>{hata}</span>
          </div>
        )}

        {detay && (
          <>
            <h1>
              <span style={{ color: "#1f9fa4" }}>{detay.idea.categoryName}</span>{" "}
              <span style={{ color: "#647a92", fontSize: "1rem" }}>· {detay.idea.provinceName}</span>
            </h1>

            <div className="bolum-basligi turuncu">Fikir</div>
            <div className="detay-icerik">{detay.idea.content || <i>(boş)</i>}</div>

            <div className="bolum-basligi mavi">Öğrenci</div>
            <div className="detay-ogrenci">
              <strong>{detay.idea.studentProfile.firstName} {detay.idea.studentProfile.lastName}</strong>
              <div className="meta">
                {detay.idea.studentProfile.provinceName}
                {detay.idea.studentProfile.school ? ` · ${detay.idea.studentProfile.school}` : ""}
                {detay.idea.studentProfile.grade ? ` · ${detay.idea.studentProfile.grade}. sınıf` : ""}
                {detay.idea.studentProfile.studentNumber ? ` · No: ${detay.idea.studentProfile.studentNumber}` : ""}
              </div>
            </div>

            <div className="bolum-basligi turkuaz">Atama</div>
            <div className="detay-atama">
              {detay.assignedEvaluatorIds.length === 0
                ? <span className="meta">Henüz değerlendirici atanmamış.</span>
                : (
                  <ul>
                    {detay.assignedEvaluatorIds.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                )}
            </div>

            <div className="bolum-basligi turuncu">Değerlendirme</div>
            {evaluations && (
              <div className="detay-degerlendirme">
                <div className="meta">
                  Eşik: <strong>{evaluations.threshold}</strong> · Toplam puan: <strong>{(evaluations.averages ? Object.values(evaluations.averages).reduce((a, b) => a + (b ?? 0), 0) / Math.max(1, Object.keys(evaluations.averages).length) : 0).toFixed(2)}</strong>
                </div>
                {Object.keys(evaluations.averages).length === 0 ? (
                  <p className="meta">Henüz puanlama yapılmamış.</p>
                ) : (
                  <ul className="kriter-liste">
                    {EVALUATION_CRITERIA.map((c) => (
                      <li key={c}>
                        <span className="kriter-ad">{CRITERION_LABELS[c]}</span>
                        <span className="kriter-ortalama">
                          {evaluations.averages[c] !== undefined ? evaluations.averages[c]!.toFixed(2) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {evaluations.evaluations.length > 0 && (
                  <details className="degerlendirici-detay">
                    <summary>{evaluations.evaluations.length} puanlama</summary>
                    <ul className="puanlama-liste">
                      {evaluations.evaluations.map((e: EvaluationEntry, i: number) => (
                        <li key={i}>
                          <strong>{CRITERION_LABELS[e.criterion]}</strong> · {e.score}/5
                          {e.comment ? <div className="meta">"{e.comment}"</div> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="fikir-butonlar">
              {managerMi && detay.idea.status !== "Locked" && (
                <button type="button" className="btn-ana" onClick={ataModalAc}>
                  🧑‍⚖️ Değerlendiriciye Ata
                </button>
              )}
              {detay.idea.status !== "Locked" && (
                <button type="button" className="btn-ikincil" onClick={() => setPuanlamaAcik(true)}>
                  ✏️ Puanla / Yorumla
                </button>
              )}
              {managerMi && detay.idea.status === "EvaluationCompleted" && (
                <button type="button" className="btn-ana" onClick={onayla} disabled={onayCalisiyor}>
                  {onayCalisiyor ? "Onaylanıyor…" : "✅ İl Onayı Ver"}
                </button>
              )}
              {detay.idea.status === "Locked" && (
                <span className="meta">🔒 İl onayı verildi; fikir kilitli.</span>
              )}
            </div>
          </>
        )}
      </section>

      {ataAcik && (
        <div className="af-lightbox" role="dialog" aria-modal="true">
          <div className="fikir-karti auth-modal-kart">
            <h2 className="auth-modal-baslik">
              <span style={{ color: "#1f9fa4" }}>Değerlendirici</span>{" "}
              <span style={{ color: "#ef7814" }}>Ata</span>
            </h2>
            {evaluatorler.length === 0 ? (
              <p>Değerlendirici listesi yükleniyor…</p>
            ) : (
              <div className="auth-form">
                <div className="alan">
                  <span>Değerlendirici seç</span>
                  <select
                    className="tema-secim"
                    value={seciliEvaluator}
                    onChange={(e) => setSeciliEvaluator(e.target.value)}
                  >
                    <option value="">Seç…</option>
                    {evaluatorler.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fikir-butonlar">
                  <button type="button" className="btn-ikincil" onClick={() => setAtaAcik(false)}>
                    İptal
                  </button>
                  <button
                    type="button"
                    className="btn-ana"
                    onClick={ataGonder}
                    disabled={!seciliEvaluator || atamaCalisiyor}
                  >
                    {atamaCalisiyor ? "Atanıyor…" : "Ata"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {puanlamaAcik && (
        <div className="af-lightbox" role="dialog" aria-modal="true">
          <div className="fikir-karti auth-modal-kart" style={{ maxWidth: "36rem" }}>
            <h2 className="auth-modal-baslik">
              <span style={{ color: "#1f9fa4" }}>Fikri</span>{" "}
              <span style={{ color: "#ef7814" }}>Puanla</span>
            </h2>
            <p className="meta">Her kriter için 1-5 arası puan ver (5 = en iyi). Yorum opsiyonel.</p>
            <div className="auth-form">
              {EVALUATION_CRITERIA.map((c) => (
                <div key={c} className="alan">
                  <span>{CRITERION_LABELS[c]} · <strong>{puanlar[c].score}/5</strong></span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={puanlar[c].score}
                    onChange={(e) =>
                      setPuanlar((prev) => ({
                        ...prev,
                        [c]: { ...prev[c], score: Number(e.target.value) },
                      }))
                    }
                  />
                  <input
                    className="tema-input"
                    placeholder="Yorum (opsiyonel)"
                    value={puanlar[c].comment}
                    onChange={(e) =>
                      setPuanlar((prev) => ({
                        ...prev,
                        [c]: { ...prev[c], comment: e.target.value },
                      }))
                    }
                    maxLength={500}
                  />
                </div>
              ))}
              <div className="fikir-butonlar">
                <button type="button" className="btn-ikincil" onClick={() => setPuanlamaAcik(false)}>
                  İptal
                </button>
                <button
                  type="button"
                  className="btn-ana"
                  onClick={puanlamaGonder}
                  disabled={puanlamaCalisiyor}
                >
                  {puanlamaCalisiyor ? "Gönderiliyor…" : "Puanları Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal acik={authAcik} onAuthed={authGuncelle} sadeceGiris />
    </main>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
