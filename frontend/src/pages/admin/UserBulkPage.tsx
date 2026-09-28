// Bulk CSV Import sayfası — Sprint 11.5 P2.
//
// YEGİTEK için: 81 il AR-GE personeli tek tek eklemek yerine CSV yükleme.
// Form: dosya seçici + örnek şablon indirme + yükleme butonu.
// Sonuç: başarılı/hata detayları tablosu.

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { rolAdi } from "../../services/roles";
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
izmir-il-arge@il.meb.gov.tr,Mehmet,Yılmaz,ProvinceEvaluator,35,GeciciSifre2`;

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
        err instanceof ApiHttpError ? err.message : "Yükleme sırasında hata oluştu.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  function sablonIndir() {
    const blob = new Blob([ORNEK_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kullanicilar-sablon.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-bulk">
      <h2>Toplu Kullanıcı İçe Aktarma (CSV)</h2>
      <p>
        YEGİTEK kurulumu: 81 il AR-GE biriminin hesaplarını tek seferde oluşturmak için
        CSV yükleyin. Maksimum 5 MB / önerilen &lt;=1000 satır.
      </p>

      <div className="csv-rehber" aria-labelledby="csv-rehber-baslik">
        <h3 id="csv-rehber-baslik">Nasıl hazırlanır?</h3>
        <p>Şu 3 adımı izleyin:</p>

        <div className="csv-adim csv-adim-ilk">
          <div className="csv-adim-no" aria-hidden="true">1</div>
          <div className="csv-adim-icerik">
            <b>Örnek CSV'yi indir.</b> Aşağıdaki butonla şablon.csv bilgisayarınıza iner.
          </div>
        </div>
        <div className="csv-adim">
          <div className="csv-adim-no" aria-hidden="true">2</div>
          <div className="csv-adim-icerik">
            <b>Excel veya Not Defteri ile düzenle.</b> Her satıra bir kullanıcı gelecek şekilde
            aşağıdaki sütunları doldurun. İlk satır başlık, değiştirmeyin.
          </div>
        </div>
        <div className="csv-adim">
          <div className="csv-adim-no" aria-hidden="true">3</div>
          <div className="csv-adim-icerik">
            <b>Dosyayı UTF-8 kaydedin ve yükleyin.</b> Excel'de "CSV UTF-8 (Virgülle ayrılmış)"
            olarak farklı kaydedin, yoksa Türkçe karakterler bozulur.
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: "0.5rem" }}>CSV sütunları</h3>
      <table className="csv-tablosu" aria-label="CSV sütun açıklamaları">
        <thead>
          <tr>
            <th>Sütun</th>
            <th>Zorunlu mu?</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>email</td><td className="zorunlu">Evet</td><td>Kullanıcının e-posta adresi. Sistemde eşsiz olmalı.</td></tr>
          <tr><td>firstName</td><td className="zorunlu">Evet</td><td>Ad (en az 2 karakter).</td></tr>
          <tr><td>lastName</td><td className="zorunlu">Evet</td><td>Soyad (en az 2 karakter).</td></tr>
          <tr><td>role</td><td className="zorunlu">Evet</td><td>SystemAdmin / MinistryOfficial / ProvinceManager / ProvinceEvaluator. Identity adı kullanılır.</td></tr>
          <tr><td>provinceCode</td><td>Hayır</td><td>İl plaka kodu (34 = İstanbul, 35 = İzmir...). ProvinceManager/Evaluator için zorunlu.</td></tr>
          <tr><td>temporaryPassword</td><td className="zorunlu">Evet</td><td>En az 8 karakter. Kullanıcı ilk girişte değiştirmek zorunda.</td></tr>
        </tbody>
      </table>

      <details className="csv-rehber" style={{ marginTop: "1rem" }}>
        <summary style={{ fontWeight: 700, cursor: "pointer", color: "#16355c" }}>
          Örnek CSV dosyası (ham metin)
        </summary>
        <pre style={{ background: "#f4f6fa", padding: "0.8rem", borderRadius: "0.5rem", overflowX: "auto", marginTop: "0.6rem" }}>
{`email,firstName,lastName,role,provinceCode,temporaryPassword
istanbul@il.meb.gov.tr,Ayşe,Demir,ProvinceManager,34,GeciciSifre1
izmir-il-arge@il.meb.gov.tr,Mehmet,Yılmaz,ProvinceEvaluator,35,GeciciSifre2
system@fikirplatformu.gov.tr,Sistem,Yöneticisi,SystemAdmin,,SistemSifre!1`}
        </pre>
      </details>

      <div style={{ display: "flex", gap: "0.7rem", marginBottom: "1.4rem", flexWrap: "wrap" }}>
        <button type="button" onClick={sablonIndir} className="csv-indir-btn">
          📥 Örnek CSV İndir
        </button>
        <Link to="/admin/users" className="btn btn-ghost">
          ← Listeye Dön
        </Link>
      </div>

      <form onSubmit={gonder} className="admin-form" aria-labelledby="csv-yukle-baslik">
        <h3 id="csv-yukle-baslik" style={{ marginTop: 0 }}>Yükle</h3>
        <label>
          CSV Dosyası
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
            disabled={calisiyor}
            aria-describedby="csv-dosya-yardim"
            required
          />
          <span id="csv-dosya-yardim" className="drawer-yardimci" style={{ display: "block", marginTop: "0.3rem" }}>
            En fazla 5 MB. UTF-8 kodlamalı olmalı.
          </span>
        </label>
        <div className="admin-form-actions">
          <button type="submit" disabled={!dosya || calisiyor} className="btn btn-primary">
            {calisiyor ? "Yükleniyor…" : `Yükle${dosya ? ` (${dosya.name})` : ""}`}
          </button>
        </div>
      </form>

      {hata && <div className="admin-hata" role="alert" aria-live="assertive">{hata}</div>}

      {sonuc && (
        <div className="admin-bulk-sonuc" aria-live="polite">
          <h3>Sonuç</h3>
          <p>
            Toplam satır: <strong>{sonuc.toplam}</strong> · Başarılı:{" "}
            <strong>{sonuc.basariliSayisi}</strong> · Hata: <strong>{sonuc.hataSayisi}</strong>
          </p>
          {sonuc.hataSayisi > 0 && (
            <details open>
              <summary>Hatalı satırlar ({sonuc.hataSayisi})</summary>
              <table className="admin-tablo">
                <thead>
                  <tr>
                    <th>Satır</th>
                    <th>E-posta</th>
                    <th>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.hatalar.map((h, i) => (
                    <tr key={i}>
                      <td>{h.satir}</td>
                      <td>{h.email}</td>
                      <td>{h.hata}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          {sonuc.basariliSayisi > 0 && (
            <details>
              <summary>Başarılı satırlar ({sonuc.basariliSayisi})</summary>
              <table className="admin-tablo">
                <thead>
                  <tr>
                    <th>Satır</th>
                    <th>E-posta</th>
                    <th>Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.basarili.map((b, i) => (
                    <tr key={i}>
                      <td>{b.satir}</td>
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
  );
}
