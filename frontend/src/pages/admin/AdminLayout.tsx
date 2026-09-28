// Sistem Yönetimi paneli — Sprint 11.65.
//
// Onur geri bildirimi: bu panel İl AR-GE / Bakanlık panellerinin düzenini
// kullanmıyordu. İki ayrı AdminLayout vardı:
//   * components/AdminLayout.tsx  → sol kenar paneli + Çıkış Yap  (il/bakanlık)
//   * pages/admin/AdminLayout.tsx → yalnızca üst menü şeridi        (admin)
// Admin panelinde çıkış butonu YOKTU. Üstelik `KullaniciCikis`
// bileşeni de `/admin` altında bilerek gizlenmişti ("AdminLayout kendi
// menüsünü içeriyor" varsayımı yanlıştı). İki eksiğin birbirini
// gizlemesi sonucu çıktı.
//
// Düzeltme: bu dosya artık ortak `components/AdminLayout`'ı kullanıyor.
// Böylece kenar paneli, kullanıcı kutusu ve Çıkış Yap düğmesi tüm
// panellerde ortaktır.

import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  AdminLayout as PanelCerceve,
  panelIkon,
  type PanelMenuItem,
} from "../../components/AdminLayout";
import { me } from "../../services/auth";
import type { MeSession } from "../../types";

const MENU: PanelMenuItem[] = [
  { hedef: "/admin/users", baslik: "Kullanıcılar", svg: panelIkon.kullanici, aktifYol: "/admin/users" },
  { hedef: "/admin/users/bulk", baslik: "Toplu Ekleme", svg: panelIkon.yukle },
  { hedef: "/admin/raporlar", baslik: "Denetim Raporları", svg: panelIkon.rapor },
  { hedef: "/admin/oauth", baslik: "E-posta Ayarları", svg: panelIkon.ePosta },
];

function baslikBul(yol: string): string {
  if (yol === "/admin" || yol === "/admin/users") return "Kullanıcı Yönetimi";
  if (yol === "/admin/users/bulk") return "Toplu Kullanıcı Ekleme";
  if (yol === "/admin/raporlar") return "Denetim Raporları";
  if (yol === "/admin/oauth") return "E-posta Ayarları";
  if (yol.endsWith("/new")) return "Yeni Kullanıcı";
  if (yol.includes("/sifre")) return "Şifre Sıfırlama";
  return "Sistem Yönetimi";
}

/** SystemAdmin oturumunu bul — kenar paneli ad/rol göstermesi için. */
function adminOturumuBul(oturumlar: MeSession[] | undefined): MeSession | null {
  return oturumlar?.find((s) => s.roles?.includes("SystemAdmin")) ?? null;
}

export function AdminLayout() {
  const konum = useLocation();
  const [oturumlar, setOturumlar] = useState<MeSession[] | undefined>(undefined);

  useEffect(() => {
    let iptal = false;
    me()
      .then((cevap) => {
        if (!iptal) setOturumlar(cevap.authenticated ? cevap.sessions : []);
      })
      .catch(() => {
        if (!iptal) setOturumlar([]);
      });
    return () => {
      iptal = true;
    };
  }, []);

  return (
    <PanelCerceve
      ben={adminOturumuBul(oturumlar) ?? null}
      baslik={baslikBul(konum.pathname)}
      menu={MENU}
    >
      <Outlet />
    </PanelCerceve>
  );
}
