// /il-panel — İl AR-GE gelen kutusu (Aşama 4, admin temalı).
// ProvinceEvaluator veya ProvinceManager rolü olmadan /fikir'e yönlendirir.

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { getInbox } from "../services/province";
import { type InboxEntry, type MeSession, sessionForContext } from "../types";

export function ProvinceInboxPage() {
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);

  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [arama, setArama] = useState("");

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

  // Province session yoksa anasayfaya yönlendir (popup gösterme — sadece anasayfadan giriş yapılır).
  if (kimlikKontrolEdildi && !ben) {
    return <Navigate to="/" replace />;
  }

  const filtreli = arama.trim()
    ? inbox.filter((i) =>
        [i.content, i.studentFirstName, i.studentLastName, i.categoryName, i.studentSchool ?? ""]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(arama.trim().toLocaleLowerCase("tr-TR")),
      )
    : inbox;
  const okunmamis = inbox.filter((i) => !i.isReadByMe).length;

  return (
    <AdminLayout
      ben={ben}
      baslik="Gelen Fikirler"
      aciklama={`${ben ? `${ben.firstName} ${ben.lastName} · ` : ""}${inbox.length} başvuru, ${okunmamis} okunmamış · tarihe göre sıralanır`}
      donemRozet="📅 2026-2027 · Eylül"
    >
      {!kimlikKontrolEdildi && (
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
      )}

      {kimlikKontrolEdildi && ben && (
        <>
          <div className="istatistikler" style={{ marginBottom: "1rem" }}>
            <div className="istat">
              <span className="ikon turkuaz">📥</span>
              <div><div className="sayi">{inbox.length}</div><div className="istat-etiket">Toplam Başvuru</div></div>
            </div>
            <div className="istat">
              <span className="ikon turuncu">●</span>
              <div><div className="sayi">{okunmamis}</div><div className="istat-etiket">Okunmamış</div></div>
            </div>
            <div className="istat">
              <span className="ikon sari">🧑‍⚖️</span>
              <div><div className="sayi">{inbox.filter((i) => i.assignedEvaluatorUserIds.length > 0).length}</div><div className="istat-etiket">Atanmış</div></div>
            </div>
          </div>

          <section className="tablo-kart">
            <div className="tablo-araclar">
              <input
                className="arama-kutu"
                type="text"
                placeholder="Öğrenci, fikir veya okul ara..."
                value={arama}
                onChange={(e) => setArama(e.target.value)}
              />
              <span className="tablo-notu">Fikirler tarihe göre sıralanır · En yeni üstte</span>
            </div>

            {hata && (
              <div className="status-banner status-banner--error" role="alert" style={{ marginBottom: "0.8rem" }}>
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

            {!yukleniyor && inbox.length > 0 && (
              <div className="tablo-sarmal">
                <table className="tablo">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Tema</th>
                      <th>Öğrenci</th>
                      <th>İçerik</th>
                      <th>Değerlendirildi</th>
                      <th>Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreli.map((i) => (
                      <tr
                        key={i.ideaId}
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/il-panel/fikir/${i.ideaId}`)}
                      >
                        <td>
                          {i.isReadByMe
                            ? <span className="durum yesil">✓ Okundu</span>
                            : <span className="durum turuncu">● Yeni</span>}
                        </td>
                        <td><strong>{i.categoryName}</strong></td>
                        <td>
                          <strong>{i.studentFirstName} {i.studentLastName}</strong>
                          <div className="meta">
                            {i.studentSchool ?? "(okul yok)"}
                            {i.studentGrade ? ` · ${i.studentGrade}. sınıf` : ""}
                          </div>
                        </td>
                        <td className="fikir-hucre">
                          <div className="icerik-ozet">{i.content || <i>(boş)</i>}</div>
                        </td>
                        <td>
                          {i.evaluationCount === 0
                            ? <span className="meta">—</span>
                            : (
                              <>
                                <b>{i.evaluationCount}</b>{" "}kez
                                {i.lastEvaluatedAt && (
                                  <div className="meta">
                                    {new Date(i.lastEvaluatedAt).toLocaleDateString("tr-TR")}
                                  </div>
                                )}
                              </>
                            )}
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
              </div>
            )}
          </section>
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

