// /il-panel/fikir/{id} — başvuru detayı (Aşama 4).
// Açılır açılmaz otomatik olarak okundu işaretler; ProvinceManager ise atama modalı açabilir.

import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import {
  assignEvaluator,
  getProvinceIdea,
  listEvaluators,
  markRead,
} from "../services/province";
import type {
  IdeaDetailResponse,
  MeAuthenticated,
  ProvinceEvaluatorRef,
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

  // atama modal
  const [ataAcik, setAtaAcik] = useState(false);
  const [evaluatorler, setEvaluatorler] = useState<ProvinceEvaluatorRef[]>([]);
  const [seciliEvaluator, setSeciliEvaluator] = useState<string>("");
  const [atamaCalisiyor, setAtamaCalisiyor] = useState(false);

  // /me
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => { if (c.authenticated) setBen(c); else setAuthAcik(true); })
      .catch(() => setAuthAcik(true))
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // detay + otomatik okundu
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

  if (!kimlikKontrolEdildi) {
    return (
      <main className="fikir-hero">
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} />
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

            <div className="fikir-butonlar">
              {managerMi && (
                <button type="button" className="btn-ana" onClick={ataModalAc}>
                  🧑‍⚖️ Değerlendiriciye Ata
                </button>
              )}
              <button type="button" className="btn-ikincil" disabled>
                ✏️ Değerlendir (Aşama 5)
              </button>
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

      <AuthModal acik={authAcik} onAuthed={authGuncelle} />
    </main>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
