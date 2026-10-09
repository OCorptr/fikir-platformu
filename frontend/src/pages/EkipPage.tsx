// /il-panel/ekip — İl AR-GE yöneticisinin kendi iline değerlendirici atadığı sayfa.
// Sprint 6 §42 #3: her manager sadece kendi iline atama yapabilir; atanan kişi
// yeni görevli atayamaz (sadece değerlendirir).

import { useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout";
import {
  createEvaluatorOnProvince,
  listEvaluators,
  removeEvaluatorFromProvince,
} from "../services/province";
import { me } from "../services/auth";
import { ApiHttpError } from "../services/api";
import { sessionForContext, type MeSession } from "../types";
import { UserCreateModal } from "./admin/UserCreateModal";

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
  // Sprint 11.92: değerlendirici ekleme artık admin panelindeki AYNI modal.
  const [ekleAcik, setEkleAcik] = useState(false);
  // Onur (S11.74): sistem yoneticisi "tum iller" kapsaminda oldugu icin
  // Onur (S11.74): sistem yönetici "tüm iller" kapsamında olduğu için
  // değerlendirici atanacağı ili kendisi seçer — seçim modalın içinde.
  // İl yöneticisinde seçim yok, kendi ili kullanılır (undefined gönderilir).

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

  // Sistem yoneticisi de il ekibini gorebilir/olusturabilir (S11.74 istisnasi).
  const sistemAdminMi = ben?.roles.includes("SystemAdmin") ?? false;
  const managerMi = sistemAdminMi || (ben?.roles.includes("ProvinceManager") ?? false);
  const ilSecmeli = sistemAdminMi;

  // Sistem yöneticisi "tüm iller" kapsamında olduğu için il seçimi modalın
  // içinde yapılıyor (Sprint 11.92) — burada ayrı il listesi yüklenmiyor.

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
            {/* Sprint 11.92 (Onur): "İl AR-GE'deki değerlendirici atama arayüzü
                kötü, sistem yöneticisinin admin/users'daki gibi olmalı, farklı
                olmamalı." → Elle yazılmış form kaldırıldı; AYNI UserCreateModal
                (yan çekmece, otomatik şifre, alan doğrulama, panoya kopyalama)
                kullanılıyor. Tek fark: POST hedefi — sistem yöneticisi admin
                ucunu, il yöneticisi kendi il ucunu çağırıyor (`olustur`). */}
            <div className="bolum-satir-baslik">
              <div className="bolum-basligi turkuaz">👥 Atanmış Değerlendiriciler ({ekip.length})</div>
              <div className="bolum-satir-butonlar">
                <button
                  type="button"
                  className="btn-ana btn-kucul"
                  onClick={() => setEkleAcik(true)}
                >
                  ➕ Değerlendirici Ekle
                </button>
              </div>
            </div>
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

      {/* Admin panelindeki AYNI modal (Sprint 11.92 — "farklı olmamalı"). */}
      <UserCreateModal
        acik={ekleAcik}
        onClose={() => setEkleAcik(false)}
        grupKodu="IlEvaluator"
        basariliCallback={() => { void ekipYukle(); }}
        olustur={async (p) => {
          // Sistem yöneticisi tüm illeri gördüğü için ili seçer; il yöneticisi
          // için provinceId gönderilmez, backend kendi ilini kullanır.
          await createEvaluatorOnProvince({
            email: p.email,
            password: p.password,
            firstName: p.firstName,
            lastName: p.lastName,
            provinceId: p.ilKodu,
          });
        }}
      />
    </AdminLayout>
  );
}