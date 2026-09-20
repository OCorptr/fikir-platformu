// /il-panel/ekip — İl AR-GE yöneticisinin kendi iline değerlendirici atadığı sayfa.
// Sprint 6 §42 #3: her manager sadece kendi iline atama yapabilir; atanan kişi
// yeni görevli atayamaz (sadece değerlendirir).

import { useEffect, useState, type FormEvent } from "react";
import { AdminLayout } from "../components/AdminLayout";
import {
  createEvaluatorOnProvince,
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
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
  const ekipYukle = (controller?: AbortController) =>
    listEvaluators(controller?.signal)
      .then((liste) => setEkip(liste as AtamaSatir[]))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setHata(e instanceof ApiHttpError ? e.message : "Ekip listesi yüklenemedi.");
        }
      });

  useEffect(() => {
    if (!ben) return;
    const controller = new AbortController();
    ekipYukle(controller);
    return () => controller.abort();
  }, [ben]);

  const managerMi = ben?.roles.includes("ProvinceManager") ?? false;

  async function ataOlayi(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || !ad.trim() || !soyad.trim()) {
      setHata("E-posta, şifre, ad ve soyad zorunludur.");
      return;
    }
    if (password.length < 5) {
      setHata("Şifre en az 5 karakter olmalı.");
      return;
    }
    setCalisiyor(true);
    setHata(null);
    try {
      await createEvaluatorOnProvince({
        email: email.trim(),
        password,
        firstName: ad.trim(),
        lastName: soyad.trim(),
      });
      setEmail(""); setPassword(""); setAd(""); setSoyad("");
      await ekipYukle();
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
      await ekipYukle();
    } catch (err) {
      setHata(err instanceof ApiHttpError ? err.message : "Kaldırma başarısız.");
    }
  }

  return (
    <AdminLayout
      ben={ben}
      baslik="Ekip Yönetimi"
      aciklama="Kendi iline yeni değerlendirici oluştur (e-posta + şifre). Atanan kişi tüm panele erişir, sadece yeni atama yapamaz."
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
            <form onSubmit={ataOlayi} className="ekip-ekle-form">
              <label>
                <span style={{ display: "block", fontSize: "0.8rem", color: "#647a92" }}>Ad</span>
                <input className="arama-kutu" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ayşe" />
              </label>
              <label>
                <span style={{ display: "block", fontSize: "0.8rem", color: "#647a92" }}>Soyad</span>
                <input className="arama-kutu" value={soyad} onChange={(e) => setSoyad(e.target.value)} placeholder="Yılmaz" />
              </label>
              <label>
                <span style={{ display: "block", fontSize: "0.8rem", color: "#647a92" }}>E-posta</span>
                <input className="arama-kutu" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="degerlendirici@ilarge.gov.tr" />
              </label>
              <label>
                <span style={{ display: "block", fontSize: "0.8rem", color: "#647a92" }}>Şifre (en az 5)</span>
                <input className="arama-kutu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="•••••" />
              </label>
              <button type="submit" className="btn-ana" disabled={calisiyor}>
                {calisiyor ? "Oluşturuluyor…" : "➕ Ekle"}
              </button>
            </form>
            <p className="tablo-notu" style={{ marginBottom: "0.8rem" }}>
              Eklenen kişiye sadece giriş bilgilerini (e-posta + şifre) iletin. Tüm il panellerine erişir, atama yapamaz.
            </p>

            {yukleniyor ? (
              <div className="status-banner status-banner--info">
                <span className="status-banner__icon">i</span>
                <span>Ekip yükleniyor…</span>
              </div>
            ) : ekip.length === 0 ? (
              <div className="il-panel-bos">
                <p>Henüz atanmış değerlendirici yok.</p>
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