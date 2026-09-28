// Toplu CSV içe aktarma sayfası — Sprint 11.5 P2, Sprint 11.64 yeniden tasarım.
//
// YEĞİTEK kurulumu: 81 il AR-GE biriminin hesaplarını tek seferde oluşturmak
// için CSV yüklenir. Görsel dil İl AR-GE / Bakanlık panellerinden alındı
// (admin-theme.css).
//
// Sprint 11.63 (YG-03/31/32): backend artık üç katmanlı beyaz listeye geçti —
// uzantı `.csv`, MIME CSV ailesi, içerik zorunlu başlık sütunları. Aşağıdaki
// `accept` yalnızca tarayıcı seçici içindir; asıl kontrol sunucudadır.

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiHttpError } from "../../services/api";

interface BulkResultRow {
  satir: number;
  email: string;
  role?: string;
  id?: string;
  hata?: string;
}

interface BulkResult {
  toplam: number;
  basariliSayisi: number;
  hataSayisi: number;
  basarili: BulkResultRow[];
  hatalar: BulkResultRow[];
}

const ORNEK_CSV = `email,firstName,lastName,role,provinceCode,temporaryPassword
istanbul@il.meb.gov.tr,Ayşe,Demir,ProvinceManager,34,GeciciSifre1
izmir-il-arge@il.meb.gov.tr,Mehmet,Yılmaz,ProvinceEvaluator,35,GeciciSifre2
system@fikirplatformu.gov.tr,Sistem,Yöneticisi,SystemAdmin,,SistemSifre!1`;

const SUTUNLAR: Array<{ ad: string; zorunlu: boolean; aciklama: string }> = [
  {
    ad: "email",
    zorunlu: true,
    aciklama: "Kullanıcının e-posta adresi. Sistemde eşsiz olmalı.",
  },
  { ad: "firstName", zorunlu: true, aciklama: "Ad (en az 2 karakter)." },
  { ad: "lastName", zorunlu: true, aciklama: "Soyad (en az 2 karakter)." },
  {
    ad: "role",
    zorunlu: true,
    aciklama:
      "SystemAdmin / MinistryOfficial / ProvinceManager / ProvinceEvaluator. " +
      "Identity adı kullanılır.",
  },
  {
    ad: "provinceCode",
    zorunlu: false,
    aciklama:
      "İl plaka kodu (34 = İstanbul, 35 = İzmir…). ProvinceManager ve " +
      "ProvinceEvaluator için zorunlu.",
  },
  {
    ad: "temporaryPassword",
    zorunlu: true,
    aciklama: "En az 8 karakter. Kullanıcı ilk girişte değiştirmek zorunda.",
  },
];

const ADIMLAR = [
  {
    baslik: "Örnek CSV'yi indirin",
    metin: "Aşağıdaki düğme ile şablon dosya bilgisayarınıza iner.",
  },
  {
    baslik: "Excel ya da Not Defteri ile düzenleyin",
    metin:
      "Her satıra bir kullanıcı gelecek şekilde sütunları doldurun. " +
      "İlk satır başlıktır, değiştirmeyin.",
  },
  {
    baslik: "UTF-8 olarak kaydedip yükleyin",
    metin:
      "Excel'de \"CSV UTF-8 (Virgülle ayrılmış)\" olarak farklı kaydedin; " +
      "aksi hâlde Türkçe karakterler bozulur.",
  },
];

export function UserBulkPage() {
  const [dosya, setDosya] = useState<File | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState<BulkResult | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    if (!dosya) return;
    setHata(null);
    setSonuc(null);
    setCalisiyor(true);

    const fd = new FormData();
    fd.append("file", dosya);

    try {
      const resp = await fetch("/api/admin/users/bulk", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new ApiHttpError(
          resp.status,
          body?.message || `Yükleme başarısız (HTTP ${resp.status}).`,
          body,
        );
      }
      setSonuc((await resp.json()) as BulkResult);
    } catch (err) {
      setHata(
        err instanceof ApiHttpError
          ? err.message
          : "Yükleme sırasında hata oluştu.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  function sablonIndir() {
    const blob = new Blob(["﻿", ORNEK_CSV], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kullanicilar-sablon.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="adm-sayfa">
      <p className="adm-aciklama">
        81 il AR-GE biriminin hesaplarını tek seferde oluşturmak için CSV
        yükleyin. En fazla 5&nbsp;MB, önerilen 1.000 satır.
      </p>

      <section className="adm-kart" aria-labelledby="adm-nasil-baslik">
        <h2 id="adm-nasil-baslik" className="adm-h2" style={{ marginTop: 0 }}>
          Nasıl hazırlanır?
        </h2>
        <ol className="adm-kucuk-metin" style={{ lineHeight: 1.9, paddingLeft: "1.2rem" }}>
          {ADIMLAR.map((a) => (
            <li key={a.baslik}>
              <strong style={{ color: "var(--yt-lacivert)" }}>{a.baslik}.</strong>{" "}
              {a.metin}
            </li>
          ))}
        </ol>
        <div className="adm-btn-kuyruk">
          <button type="button" className="adm-btn adm-btn-ana" onClick={sablonIndir}>
            Örnek CSV İndir
          </button>
          <Link to="/admin/users" className="adm-btn adm-btn-sessiz">
            ← Listeye Dön
          </Link>
        </div>
      </section>

      <section aria-labelledby="adm-sutun-baslik">
        <h2 id="adm-sutun-baslik" className="adm-h2">
          CSV Sütunları
        </h2>
        <table className="adm-tablo">
          <caption className="sr-only">CSV sütun açıklamaları</caption>
          <thead>
            <tr>
              <th scope="col">Sütun</th>
              <th scope="col">Zorunlu mu?</th>
              <th scope="col">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {SUTUNLAR.map((s) => (
              <tr key={s.ad}>
                <td>
                  <code>{s.ad}</code>
                </td>
                <td>
                  <span
                    className={
                      s.zorunlu
                        ? "adm-rozet adm-rozet-kirmizi"
                        : "adm-rozet"
                    }
                  >
                    {s.zorunlu ? "Zorunlu" : "İsteğe bağlı"}
                  </span>
                </td>
                <td>{s.aciklama}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <details className="adm-kart">
        <summary className="adm-etiket" style={{ cursor: "pointer" }}>
          Örnek CSV içeriği
        </summary>
        <pre className="adm-metin-kutusu" style={{ marginTop: "0.6rem" }}>
          {ORNEK_CSV}
        </pre>
      </details>

      <section className="adm-kart" aria-labelledby="adm-yukle-baslik">
        <h2 id="adm-yukle-baslik" className="adm-h2" style={{ marginTop: 0 }}>
          Dosyayı Yükle
        </h2>

        <form onSubmit={gonder}>
          <label className="adm-alan">
            <span className="adm-etiket">CSV Dosyası</span>
            <input
              className="adm-input"
              type="file"
              name="file"
              accept=".csv,text/csv"
              onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
              disabled={calisiyor}
              aria-describedby="csv-dosya-yardim"
              required
            />
            <span id="csv-dosya-yardim" className="adm-etiket adm-etiket-hint">
              Yalnızca <code>.csv</code>. En fazla 5&nbsp;MB, UTF-8 kodlamalı.
            </span>
          </label>

          <div className="adm-btn-kuyruk">
            <button
              type="submit"
              className="adm-btn adm-btn-ana"
              disabled={!dosya || calisiyor}
            >
              {calisiyor
                ? "Yükleniyor…"
                : dosya
                  ? `Yükle (${dosya.name})`
                  : "Yükle"}
            </button>
          </div>
        </form>

        {hata && (
          <div
            className="adm-bildirim adm-bildirim-hata"
            role="alert"
            style={{ marginTop: "1rem" }}
          >
            <span aria-hidden="true">⚠</span>
            <span>{hata}</span>
          </div>
        )}

        {sonuc && (
          <div style={{ marginTop: "1.25rem" }} aria-live="polite">
            <h3 className="adm-h2">Sonuç</h3>
            <p className="adm-satir-ara" style={{ marginBottom: "0.6rem" }}>
              <span className="adm-rozet adm-rozet-mavi">
                Toplam {sonuc.toplam} satır
              </span>
              <span className="adm-rozet adm-rozet-yesil">
                {sonuc.basariliSayisi} başarılı
              </span>
              <span
                className={
                  sonuc.hataSayisi > 0
                    ? "adm-rozet adm-rozet-kirmizi"
                    : "adm-rozet"
                }
              >
                {sonuc.hataSayisi} hata
              </span>
            </p>

            {sonuc.hataSayisi > 0 && (
              <details open>
                <summary className="adm-etiket" style={{ cursor: "pointer" }}>
                  Hatalı satırlar ({sonuc.hataSayisi})
                </summary>
                <table className="adm-tablo" style={{ marginTop: "0.6rem" }}>
                  <caption className="sr-only">Yüklenemeyen satırlar</caption>
                  <thead>
                    <tr>
                      <th scope="col">Satır</th>
                      <th scope="col">E-posta</th>
                      <th scope="col">Hata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sonuc.hatalar.map((h, i) => (
                      <tr key={`hata-${h.satir}-${i}`}>
                        <td className="adm-tablo-sayisal">{h.satir}</td>
                        <td>{h.email}</td>
                        <td>{h.hata}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}

            {sonuc.basariliSayisi > 0 && (
              <details style={{ marginTop: "0.75rem" }}>
                <summary className="adm-etiket" style={{ cursor: "pointer" }}>
                  Başarılı satırlar ({sonuc.basariliSayisi})
                </summary>
                <table className="adm-tablo" style={{ marginTop: "0.6rem" }}>
                  <caption className="sr-only">Oluşturulan kullanıcılar</caption>
                  <thead>
                    <tr>
                      <th scope="col">Satır</th>
                      <th scope="col">E-posta</th>
                      <th scope="col">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sonuc.basarili.map((b, i) => (
                      <tr key={`basari-${b.satir}-${i}`}>
                        <td className="adm-tablo-sayisal">{b.satir}</td>
                        <td>{b.email}</td>
                        <td>{b.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
