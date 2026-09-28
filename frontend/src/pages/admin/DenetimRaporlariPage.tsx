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
    <div className="adm-sayfa">
      <p className="adm-aciklama">
        Kimlik doğrulama ve hesap değişiklikleri günlük olarak dosyaya
        yazılır. Yönetmelik gereği merkezî sisteme iletilmesi gereken
        kayıtları buradan görüntüleyip indirebilirsiniz.
      </p>

      {hata && (
        <div className="adm-bildirim adm-bildirim-hata" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{hata}</span>
        </div>
      )}

      {liste && (
        <p className="adm-meta" style={{ marginBottom: "0.8rem" }}>
          Klasör: <code>{liste.klasor}</code>
          {liste.saklamaGun ? ` · Saklama süresi: ${liste.saklamaGun} gün` : ""}
        </p>
      )}

      {liste && liste.adet === 0 ? (
        <div className="adm-bos-durum">
          Henüz rapor üretilmemiş.
          <br />
          Raporlar her gece 02:00 UTC&apos;de bir önceki günün kayıtlarıyla
          oluşturulur.
        </div>
      ) : (
        <table className="adm-tablo">
          <caption className="sr-only">Günlük denetim raporları</caption>
          <thead>
            <tr>
              <th scope="col">Tarih</th>
              <th scope="col">Dosya</th>
              <th scope="col">Boyut</th>
              <th scope="col">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {liste?.raporlar.map((r) => (
              <tr key={r.dosya}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.tarih}</td>
                <td>
                  <code>{r.dosya}</code>
                </td>
                <td className="adm-tablo-sayisal">{baytGor(r.boyutBayt)}</td>
                <td>
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => void raporAc(r.dosya)}
                    disabled={calisiyor}
                  >
                    Görüntüle
                  </button>{" "}
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => indir(r.dosya, false)}
                    disabled={calisiyor}
                  >
                    JSONL
                  </button>{" "}
                  <button
                    type="button"
                    className="adm-btn"
                    onClick={() => indir(r.dosya, true)}
                    disabled={calisiyor}
                  >
                    CSV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {secili && (
        <section aria-labelledby="adm-onizleme-baslik">
          <h3 id="adm-onizleme-baslik" className="adm-h2">
            {secili.dosya}{" "}
            <span className="adm-meta">
              ({secili.satirSayisi} kayıt)
            </span>
          </h3>
          {secili.kisitli && (
            <div className="adm-bildirim adm-bildirim-uyari" role="status">
              <span aria-hidden="true">ℹ</span>
              <span>
                İlk 500 satır gösteriliyor. Tamamı için JSONL ya da CSV
                indirmesini kullanın.
              </span>
            </div>
          )}
          <pre className="adm-metin-kutusu">{secili.satirlar.join("\n")}</pre>
        </section>
      )}
    </div>
  );
}
