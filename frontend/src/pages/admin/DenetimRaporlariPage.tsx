// Denetim raporları — YEĞİTEK YG-13 / YG-18.
//
// Hareket kayıtları günlük dosyaya yazılır (JSON Lines + CSV özet).
// Bu ekran sistem yöneticisinin raporları istediği an görüntülemesini ve
// indirmesini sağlar; merkezî günlük toplama altyapısı olmayan kurumlar
// dosyayı elle veya betikle merkezî sisteme aktarabilir.

import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiHttpError } from "../../services/api";

interface RaporOzeti {
  dosya: string;
  tarih: string;
  boyutBayt: number;
  olusturma: string;
}

interface RaporListesi {
  klasor: string;
  etkin: boolean;
  saklamaGun?: number;
  adet: number;
  raporlar: RaporOzeti[];
}

interface RaporIcerik {
  dosya: string;
  satirSayisi: number;
  satirlar: string[];
  kisitli: boolean;
}

export function DenetimRaporlariPage() {
  const [liste, setListe] = useState<RaporListesi | null>(null);
  const [secili, setSecili] = useState<RaporIcerik | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const listeyiYukle = useCallback(async () => {
    try {
      const veri = await apiRequest<RaporListesi>("/api/admin/raporlar");
      setListe(veri);
    } catch (err) {
      setHata(
        err instanceof ApiHttpError ? err.message : "Raporlar yüklenemedi.",
      );
    }
  }, []);

  useEffect(() => {
    void listeyiYukle();
  }, [listeyiYukle]);

  async function raporAc(dosya: string) {
    setHata(null);
    setCalisiyor(true);
    try {
      setSecili(await apiRequest<RaporIcerik>(`/api/admin/raporlar/${dosya}`));
    } catch (err) {
      setHata(
        err instanceof ApiHttpError ? err.message : "Rapor açılamadı.",
      );
    } finally {
      setCalisiyor(false);
    }
  }

  function indir(dosya: string, ozet: boolean) {
    const ad = ozet ? dosya.replace(".jsonl", "-ozet.csv") : dosya;
    // HttpOnly cookie tabanlı yetkilendirme kullanıldığı için <a href> yerine
    // fetch + blob ile indiriyoruz.
    void (async () => {
      try {
        const duyarlilik = await fetch(`/api/admin/raporlar/${ad}/indir`, {
          credentials: "include",
        });
        if (!duyarlilik.ok) throw new Error(`HTTP ${duyarlilik.status}`);
        const blog = await duyarlilik.blob();
        const url = URL.createObjectURL(blog);
        const a = document.createElement("a");
        a.href = url;
        a.download = ad;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setHata("Rapor indirilemedi. Özet CSV için dosya adı .jsonl olmalıdır.");
      }
    })();
  }

  function baytGor(bayt: number): string {
    if (bayt < 1024) return `${bayt} B`;
    if (bayt < 1024 * 1024) return `${(bayt / 1024).toFixed(1)} KB`;
    return `${(bayt / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="admin-form">
      <h2>Denetim Raporları</h2>
      <p className="admin-form-meta">
        Kimlik doğrulama ve hesap değişiklikleri günlük olarak dosyaya
        yazılır. Yönetmelik gereği merkezî sisteme iletilmesi gereken kayıtlar
        buradan indirilebilir.
      </p>

      {hata && <div className="admin-hata">{hata}</div>}

      {liste && (
        <p className="admin-form-meta">
          Klasör: <code>{liste.klasor}</code>
          {liste.saklamaGun ? ` · Saklama: ${liste.saklamaGun} gün` : ""}
          {liste.adet === 0 && " · Henüz rapor üretilmemiş."}
        </p>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Dosya</th>
            <th>Boyut</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {liste?.raporlar.map((r) => (
            <tr key={r.dosya}>
              <td>{r.tarih}</td>
              <td>
                <code>{r.dosya}</code>
              </td>
              <td>{baytGor(r.boyutBayt)}</td>
              <td>
                <button
                  type="button"
                  onClick={() => void raporAc(r.dosya)}
                  disabled={calisiyor}
                >
                  Görüntüle
                </button>{" "}
                <button
                  type="button"
                  onClick={() => indir(r.dosya, false)}
                  disabled={calisiyor}
                >
                  İndir (JSONL)
                </button>{" "}
                <button
                  type="button"
                  onClick={() => indir(r.dosya, true)}
                  disabled={calisiyor}
                >
                  İndir (CSV)
                </button>
              </td>
            </tr>
          ))}
          {liste && liste.adet === 0 && (
            <tr>
              <td colSpan={4}>Rapor yok. Raporlar her gece 02:00 UTC'de üretilir.</td>
            </tr>
          )}
        </tbody>
      </table>

      {secili && (
        <>
          <h3>
            {secili.dosya} ({secili.satirSayisi} kayıt)
          </h3>
          {secili.kisitli && (
            <p className="admin-form-meta">
              İlk 500 satır gösteriliyor. Tamamı için indirin.
            </p>
          )}
          <pre className="admin-onizleme">{secili.satirlar.join("\n")}</pre>
        </>
      )}
    </div>
  );
}
