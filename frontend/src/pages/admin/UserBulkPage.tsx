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

      <details className="admin-bulk-sablon">
        <summary>CSV format (sütunlar)</summary>
        <pre>{`email,firstName,lastName,role,provinceCode,temporaryPassword
ahmet@example.com,Ahmet,Yılmaz,ProvinceManager,34,GeciciSifre1`}</pre>
        <p>
          <strong>Zorunlu sütunlar:</strong> email, firstName, lastName, role,
          temporaryPassword. <strong>Opsiyonel:</strong> provinceCode (il plaka kodu, 34 = İstanbul).
        </p>
        <p>
          <strong>İzinli roller (Identity adı — CSV'de bu kullanılır):</strong>{" "}
          <code>SystemAdmin</code> ({rolAdi("SystemAdmin")}),{" "}
          <code>MinistryOfficial</code> ({rolAdi("MinistryOfficial")}),{" "}
          <code>ProvinceManager</code> ({rolAdi("ProvinceManager")}),{" "}
          <code>ProvinceEvaluator</code> ({rolAdi("ProvinceEvaluator")}).{" "}
          <strong>Student rolü kabul edilmez</strong> (Sistem Admin öğrenci
          kayıtlarına erişemez — gizlilik).
        </p>
        <p>
          <strong>Şifre kuralları:</strong> minimum 8 karakter. Kullanıcı ilk girişte
          şifre değiştirmek zorunda.
        </p>
        <button type="button" onClick={sablonIndir} className="btn">
          📥 Örnek CSV İndir
        </button>
      </details>

      <form onSubmit={gonder} className="admin-form">
        <label>
          CSV Dosyası
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
            disabled={calisiyor}
            required
          />
        </label>
        <div className="admin-form-actions">
          <button type="submit" disabled={!dosya || calisiyor} className="btn btn-primary">
            {calisiyor ? "Yükleniyor…" : "Yükle"}
          </button>
          <Link to="/admin/users" className="btn">
            İptal
          </Link>
        </div>
      </form>

      {hata && <div className="admin-hata">{hata}</div>}

      {sonuc && (
        <div className="admin-bulk-sonuc">
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
