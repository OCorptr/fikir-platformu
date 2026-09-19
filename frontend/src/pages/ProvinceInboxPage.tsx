// /il-panel — İl AR-GE gelen kutusu (Aşama 4).
// ProvinceEvaluator veya ProvinceManager rolü olmadan /fikir'e yönlendirir.

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthModal } from "../components/AuthModal";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { getInbox } from "../services/province";
import type { InboxEntry, MeAuthenticated } from "../types";

export function ProvinceInboxPage() {
  // kimlik kontrolü
  const [ben, setBen] = useState<MeAuthenticated | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);
  const [authAcik, setAuthAcik] = useState(false);

  // veri
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const navigate = useNavigate();

  // /me kontrolü
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((cevap) => {
        if (cevap.authenticated) {
          setBen(cevap);
        } else {
          setAuthAcik(true);
        }
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setAuthAcik(true);
        }
      })
      .finally(() => setKimlikKontrolEdildi(true));
    return () => controller.abort();
  }, []);

  // inbox yükle
  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    setYukleniyor(true);
    setHata(null);
    getInbox(controller.signal)
      .then(setInbox)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata(mesajCikar(e));
        }
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
        <div className="yukleme-ekrani">
          <div className="yukleme-carki" aria-hidden="true" />
          <span>Yükleniyor…</span>
        </div>
        <AuthModal acik={authAcik} onAuthed={authGuncelle} />
      </main>
    );
  }

  // Rol yoksa /fikir'e yönlendir (ProvinceEvaluator veya ProvinceManager)
  const yetkili =
    ben !== null &&
    ben.roles.some((r) => r === "ProvinceEvaluator" || r === "ProvinceManager");
  if (ben && !yetkili) {
    return <Navigate to="/fikir" replace />;
  }

  const okunmamis = inbox.filter((i) => !i.isReadByMe).length;

  return (
    <main className="il-panel-hero">
      <section className={`fikir-karti ${authAcik ? "fikir-form-blur" : ""}`}>
        <h1>
          <span style={{ color: "#1f9fa4" }}>İl</span>{" "}
          <span style={{ color: "#ef7814" }}>Paneli</span>
        </h1>
        <p className="il-panel-ozet">
          {ben && `${ben.firstName} ${ben.lastName} · ${ben.roles.join(", ")}`}
          {" · "}
          <strong>{inbox.length}</strong> başvuru, <strong>{okunmamis}</strong> okunmamış.
        </p>

        {hata && (
          <div className="status-banner status-banner--error" role="alert">
            <span className="status-banner__icon">!</span>
            <span>{hata}</span>
          </div>
        )}

        {yukleniyor && (
          <div className="status-banner status-banner--info">
            <span className="status-banner__icon">i</span>
            <span>Gelen kutusu yükleniyor…</span>
          </div>
        )}

        {!yukleniyor && inbox.length === 0 && (
          <div className="il-panel-bos">
            <p>📭 Şu an ilinize gönderilmiş bir fikir bulunmuyor.</p>
          </div>
        )}

        {inbox.length > 0 && (
          <table className="il-panel-tablo">
            <thead>
              <tr>
                <th></th>
                <th>Tema</th>
                <th>Öğrenci</th>
                <th>İçerik</th>
                <th>Atanan</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {inbox.map((i) => (
                <tr
                  key={i.ideaId}
                  className={i.isReadByMe ? "" : "okunmamis"}
                  onClick={() => navigate(`/il-panel/fikir/${i.ideaId}`)}
                >
                  <td>
                    {i.isReadByMe
                      ? <span className="durum-nokta okunmus">✓</span>
                      : <span className="durum-nokta okunmamis">●</span>}
                  </td>
                  <td>{i.categoryName}</td>
                  <td>
                    <strong>{i.studentFirstName} {i.studentLastName}</strong>
                    <div className="meta">
                      {i.studentSchool ?? "(okul yok)"}
                      {i.studentGrade ? ` · ${i.studentGrade}. sınıf` : ""}
                    </div>
                  </td>
                  <td className="icerik-hucre">
                    <div className="icerik-ozet">{i.content || <i>(boş)</i>}</div>
                  </td>
                  <td>
                    {i.assignedEvaluatorUserIds.length === 0
                      ? <span className="meta">atanmamış</span>
                      : <span className="meta">{i.assignedEvaluatorUserIds.length} kişi</span>}
                  </td>
                  <td>
                    <span className="meta">
                      {new Date(i.submittedAt).toLocaleDateString("tr-TR")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AuthModal acik={authAcik} onAuthed={authGuncelle} />
    </main>
  );
}

function mesajCikar(e: unknown): string {
  if (e instanceof ApiHttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Beklenmeyen bir hata oluştu.";
}
