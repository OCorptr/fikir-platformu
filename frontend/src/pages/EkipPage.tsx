// /il-panel/ekip — İl AR-GE yöneticisinin kendi iline değerlendirici atadığı sayfa.
// Sprint 6 §42 #3: her manager sadece kendi iline atama yapabilir; atanan kişi
// yeni görevli atayamaz (sadece değerlendirir).

import { useEffect, useState, type FormEvent } from "react";
import { AdminLayout } from "../components/AdminLayout";
import {
  assignEvaluatorToProvince,
  listEvaluators,
  removeEvaluatorFromProvince,
} from "../services/province";
import { me } from "../services/auth";
import { ApiHttpError } from "../services/api";
import { sessionForContext, type MeSession } from "../types";

interface AtamaSatir {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedAt: string;
}

export function EkipPage() {
  const [ben, setBen] = useState<MeSession | null>(null);
  const [ekip, setEkip] = useState<AtamaSatir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [atanacakId, setAtanacakId] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);

  // /me → manager rolü kontrolü
  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then((c) => setBen(sessionForContext(c, "province")))
      .catch(() => setBen(null))
      .finally(() => setYukleniyor(false));
    return () => controller.abort();
  }, []);

  // Ekip listesi (sadece manager kendi ilindekini görebilir)
  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    listEvaluators(controller.signal)
      .then((liste) => setEkip(liste as AtamaSatir[]))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata(e instanceof ApiHttpError ? e.message : "Ekip listesi yüklenemedi.");
        }
      });
    return () => controller.abort();
  }, [ben]);

  const managerMi = ben?.roles.includes("ProvinceManager") ?? false;

  async function ataOlayi(e: FormEvent) {
    e.preventDefault();
    if (!atanacakId.trim()) {
      setHata("Kullanıcı ID boş olamaz.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      await assignEvaluatorToProvince(atanacakId.trim());
      setAtanacakId("");
      const liste = await listEvaluators();
      setEkip(liste as AtamaSatir[]);
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Atama başarısız.");
    } finally {
      setCalisiyor(false);
    }
  }

  async function kaldirOlayi(id: string) {
    if (!confirm("Bu değerlendirici atamasını kaldırmak istediğine emin misin?")) return;
    setHata(null);
    try {
      await removeEvaluatorFromProvince(id);
      const liste = await listEvaluators();
      setEkip(liste as AtamaSatir[]);
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Kaldırma başarısız.");
    }
  }

  return (
    <AdminLayout
      ben={ben}
      baslik="Ekip Yönetimi"
      aciklama="Kendi iline değerlendirici ata veya atamasını kaldır."
    >
      <section className="tablo-kart">
        {hata && (
          <div className="status-banner status-banner--error" role="alert" style={{ marginBottom: "0.8rem" }}>
            <span className="status-banner__icon">!</span>
            <span>{hata}</span>
          </div>
        )}

        {managerMi ? (
          <>
            <form onSubmit={ataOlayi} className="tablo-araclar" style={{ marginBottom: "1rem" }}>
              <input
                className="arama-kutu"
                placeholder="Değerlendirici Kullanıcı ID (örn: 3a2ed34d-...)"
                value={atanacakId}
                onChange={(e) => setAtanacakId(e.target.value)}
                style={{ minWidth: "20rem" }}
              />
              <button type="submit" className="btn-ana" disabled={calisiyor}>
                {calisiyor ? "Atanıyor…" : "➕ Değerlendirici Ata"}
              </button>
              <span className="tablo-notu">
                Kullanıcının <b>ProvinceEvaluator</b> rolünde olması gerekir.
              </span>
            </form>

            {yukleniyor ? (
              <div className="status-banner status-banner--info">
                <span className="status-banner__icon">i</span>
                <span>Ekip yükleniyor…</span>
              </div>
            ) : ekip.length === 0 ? (
              <div className="il-panel-bos">
                <p>Henüz atanmış değerlendirici yok. Yukarıdaki alana kullanıcı ID girip "Ata" de.</p>
              </div>
            ) : (
              <table className="veri-tablo">
                <thead>
                  <tr>
                    <th>Ad Soyad</th>
                    <th>E-posta</th>
                    <th>Atanma Tarihi</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {ekip.map((k) => (
                    <tr key={k.id}>
                      <td><b>{k.firstName} {k.lastName}</b></td>
                      <td><span className="meta">{k.email}</span></td>
                      <td>
                        <span className="meta">
                          {new Date(k.assignedAt).toLocaleDateString("tr-TR")}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="taslak-islem tehlikeli"
                          onClick={() => kaldirOlayi(k.id)}
                        >
                          Kaldır
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <div className="il-panel-bos">
            <p>Bu sayfa yalnızca <b>İl AR-GE Yöneticisi</b> için. Atanmış kişiler değerlendirir, yeni atama yapamaz.</p>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}