// /il-panel/rapor — İl bazlı raporlama (admin.html "Raporlama" sekmesi eşdeğeri).
// İl AR-GE Yönetici ve Değerlendirici rolleri erişebilir.
// Veriler inbox endpoint'inden client-side aggregation ile üretilir.

import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminLayout } from "../components/AdminLayout";
import { ApiHttpError } from "../services/api";
import { me } from "../services/auth";
import { getInbox } from "../services/province";
import { type InboxEntry, type MeSession, sessionForContext } from "../types";

const TEMA_EMOJI: Record<string, string> = {
  "Kültür ve Sanat": "🎨",
  "Spor ve Sağlıklı Yaşam": "⚽",
  "Bilim ve Teknoloji": "🔬",
  "Çevre ve Sürdürülebilirlik": "🌱",
  "Yapay Zekâ": "🤖",
  "Girişimcilik": "💡",
  "Değerler Eğitimi": "📖",
  "Sosyal Sorumluluk": "🤝",
};
const temaEmoji = (k: string) => TEMA_EMOJI[k] ?? "💡";

const TEMA_BAR_RENK: Record<string, string> = {
  "Bilim ve Teknoloji": "turkuaz",
  "Çevre ve Sürdürülebilirlik": "yesil",
  "Yapay Zekâ": "mor",
  "Spor ve Sağlıklı Yaşam": "turuncu",
  "Kültür ve Sanat": "kirmizi",
};
const temaBarRenk = (k: string) => TEMA_BAR_RENK[k] ?? "turkuaz";

export function ProvinceReportPage() {
  const [ben, setBen] = useState<MeSession | null>(null);
  const [kimlikKontrolEdildi, setKimlikKontrolEdildi] = useState(false);

  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [temaFiltresi, setTemaFiltresi] = useState("");
  const [degerlendirmeFiltresi, setDegerlendirmeFiltresi] = useState<"hepsi" | "degis" | "degmemis">("hepsi");
  const [okunduFiltresi, setOkunduFiltresi] = useState<"hepsi" | "okundu" | "okunmamis">("hepsi");

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
        if (!(e instanceof DOMException && e.name === "AbortError")) setHata(mesajCikar(e));
      })
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, [ben]);

  if (kimlikKontrolEdildi && !ben) {
    return <Navigate to="/" replace />;
  }

  const temalar = useMemo(
    () => Array.from(new Set(inbox.map((i) => i.categoryName))).sort((a, b) => a.localeCompare(b, "tr")),
    [inbox],
  );

  const filtreli = useMemo(
    () =>
      inbox.filter((i) => {
        if (temaFiltresi && i.categoryName !== temaFiltresi) return false;
        if (degerlendirmeFiltresi === "degis" && i.evaluationCount === 0) return false;
        if (degerlendirmeFiltresi === "degmemis" && i.evaluationCount > 0) return false;
        if (okunduFiltresi === "okundu" && !i.isReadByMe) return false;
        if (okunduFiltresi === "okunmamis" && i.isReadByMe) return false;
        return true;
      }),
    [inbox, temaFiltresi, degerlendirmeFiltresi, okunduFiltresi],
  );

  // Tema dağılımı: kategori başına adet + yüzde
  const temaDagilimi = useMemo(() => {
    const toplam = filtreli.length || 1;
    const sayac = new Map<string, number>();
    for (const i of filtreli) sayac.set(i.categoryName, (sayac.get(i.categoryName) ?? 0) + 1);
    return Array.from(sayac.entries())
      .map(([kat, adet]) => ({ kat, adet, yuzde: Math.round((adet / toplam) * 100) }))
      .sort((a, b) => b.adet - a.adet);
  }, [filtreli]);

  // Durum dağılımı: değerlendirildi / değerlendirilmedi
  const durumDagilimi = useMemo(() => {
    const toplam = filtreli.length || 1;
    const evet = filtreli.filter((i) => i.evaluationCount > 0).length;
    const hayir = toplam - evet;
    return { evet, hayir, evetYuzde: Math.round((evet / toplam) * 100), hayirYuzde: Math.round((hayir / toplam) * 100) };
  }, [filtreli]);

  function csvIndir() {
    const basliklar = ["ID", "Öğrenci", "Tema", "İçerik", "Tarih", "Değerlendirme Sayısı", "Son Değerlendirme", "Okundu mu"];
    const satirlar = filtreli.map((i) => [
      i.ideaId,
      `${i.studentFirstName} ${i.studentLastName}`,
      i.categoryName,
      (i.content || "").replace(/\s+/g, " ").trim(),
      new Date(i.submittedAt).toLocaleDateString("tr-TR"),
      String(i.evaluationCount),
      i.lastEvaluatedAt ? new Date(i.lastEvaluatedAt).toLocaleDateString("tr-TR") : "",
      i.isReadByMe ? "Evet" : "Hayır",
    ]);
    const csv = [basliklar, ...satirlar]
      .map((r) => r.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `il-rapor-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout
      ben={ben}
      baslik="Raporlama"
      donemRozet="📅 2026-2027 · Eylül"
    >
      {!kimlikKontrolEdildi && (
        <div className="yukleme-ekrani"><div className="yukleme-carki" aria-hidden="true" /><span>Yükleniyor…</span></div>
      )}

      {kimlikKontrolEdildi && ben && (
        <>
          <div className="rapor-filtre">
            <select className="secim-kutu" value={temaFiltresi} onChange={(e) => setTemaFiltresi(e.target.value)}>
              <option value="">Tema: Tümü</option>
              {temalar.map((t) => (
                <option key={t} value={t}>{temaEmoji(t)} {t}</option>
              ))}
            </select>
            <select
              className="secim-kutu"
              value={degerlendirmeFiltresi}
              onChange={(e) => setDegerlendirmeFiltresi(e.target.value as typeof degerlendirmeFiltresi)}
            >
              <option value="hepsi">Durum: Tümü</option>
              <option value="degmemis">Değerlendirilmedi</option>
              <option value="degis">Değerlendirildi</option>
            </select>
            <select
              className="secim-kutu"
              value={okunduFiltresi}
              onChange={(e) => setOkunduFiltresi(e.target.value as typeof okunduFiltresi)}
            >
              <option value="hepsi">Okundu: Tümü</option>
              <option value="okunmamis">Okunmamış</option>
              <option value="okundu">Okundu</option>
            </select>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-ikincil btn-kucul" onClick={csvIndir}>⬇ Excel'e Aktar</button>
            <button type="button" className="btn-ikincil btn-kucul" onClick={() => window.print()}>🖨 Yazdır</button>
          </div>

          {hata && (
            <div className="status-banner status-banner--error" role="alert" style={{ marginBottom: "0.8rem" }}>
              <span className="status-banner__icon">!</span><span>{hata}</span>
            </div>
          )}

          {yukleniyor && (
            <div className="status-banner status-banner--info">
              <span className="status-banner__icon">i</span><span>Rapor verileri yükleniyor…</span>
            </div>
          )}

          {!yukleniyor && (
            <>
              <div className="bolum-basligi mavi">📊 Tema Dağılımı ({filtreli.length} fikir)</div>
              {temaDagilimi.length === 0 ? (
                <div className="il-panel-bos"><p>📭 Bu filtrelerle eşleşen fikir yok.</p></div>
              ) : (
                <div className="tema-mini">
                  {temaDagilimi.map((t) => (
                    <div key={t.kat} className="tm-kart">
                      <span className="tm-ad">{temaEmoji(t.kat)} {t.kat}</span>
                      <span className="tm-deger">{t.adet}</span>
                      <i className={`tm-bar ${temaBarRenk(t.kat)}`} style={{ width: `${Math.max(8, t.yuzde)}%` }} />
                    </div>
                  ))}
                </div>
              )}

              <div className="bolum-basligi turkuaz" style={{ marginTop: "1.4rem" }}>🎯 Değerlendirme Durumu</div>
              <div className="tema-mini">
                <div className="tm-kart">
                  <span className="tm-ad">✅ Değerlendirildi</span>
                  <span className="tm-deger">{durumDagilimi.evet}</span>
                  <i className="tm-bar yesil" style={{ width: `${Math.max(8, durumDagilimi.evetYuzde)}%` }} />
                </div>
                <div className="tm-kart">
                  <span className="tm-ad">⏳ Değerlendirilmedi</span>
                  <span className="tm-deger">{durumDagilimi.hayir}</span>
                  <i className="tm-bar turuncu" style={{ width: `${Math.max(8, durumDagilimi.hayirYuzde)}%` }} />
                </div>
              </div>

              <div className="bolum-basligi kirmizi" style={{ marginTop: "1.4rem" }}>📋 Fikir Kayıtları ({filtreli.length})</div>
              {filtreli.length === 0 ? (
                <div className="il-panel-bos"><p>Filtreye uyan fikir bulunmuyor.</p></div>
              ) : (
                <div className="tablo-sarmal">
                  <table className="tablo">
                    <thead>
                      <tr>
                        <th>Öğrenci</th>
                        <th>Tema</th>
                        <th>İçerik</th>
                        <th>Tarih</th>
                        <th>Değerlendirme</th>
                        <th>Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtreli.map((i) => (
                        <tr key={i.ideaId}>
                          <td>
                            <strong>{i.studentFirstName} {i.studentLastName}</strong>
                            <div className="meta">{i.studentSchool ?? "(okul yok)"}</div>
                          </td>
                          <td><strong>{temaEmoji(i.categoryName)} {i.categoryName}</strong></td>
                          <td className="fikir-hucre"><div className="icerik-ozet">{i.content || <i>(boş)</i>}</div></td>
                          <td><span className="meta">{new Date(i.submittedAt).toLocaleDateString("tr-TR")}</span></td>
                          <td>
                            {i.evaluationCount === 0 ? <span className="meta">—</span> : (
                              <>
                                <b>{i.evaluationCount}</b> kez
                                {i.lastEvaluatedAt && (
                                  <div className="meta">{new Date(i.lastEvaluatedAt).toLocaleDateString("tr-TR")}</div>
                                )}
                              </>
                            )}
                          </td>
                          <td>
                            {i.isReadByMe
                              ? <span className="durum yesil">✓ Okundu</span>
                              : <span className="durum turuncu">● Yeni</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
