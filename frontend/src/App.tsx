import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UstBar } from "./components/UstBar";
import { KullaniciCikis } from "./components/KullaniciCikis";
import FikirPage from "./pages/FikirPage";
import { SayfaBulunamadi, SunucuHatasi } from "./pages/HataSayfalari";
import { HomePage } from "./pages/HomePage";
import { ProvinceInboxPage } from "./pages/ProvinceInboxPage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { CandidatesPage } from "./pages/CandidatesPage";
import { EkipPage } from "./pages/EkipPage";
import { MinistryPage } from "./pages/MinistryPage";
import { ProvinceReportPage } from "./pages/ProvinceReportPage";
import { MfaSetupPage } from "./pages/MfaSetupPage";
import { MfaLoginPage } from "./pages/MfaLoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { UserListPage } from "./pages/admin/UserListPage";
import { UserEditPage } from "./pages/admin/UserEditPage";
import { UserBulkPage } from "./pages/admin/UserBulkPage";
import { OAuthAyarlaPage } from "./pages/admin/OAuthAyarlaPage";
import { DenetimRaporlariPage } from "./pages/admin/DenetimRaporlariPage";
import { AdminAuthGuard } from "./components/AdminAuthGuard";
import { SifremiUnuttumPage } from "./pages/SifremiUnuttumPage";
import { SifreSifirlaPage } from "./pages/SifreSifirlaPage";
import { SifreDegistirPage } from "./pages/SifreDegistirPage";
import { SifreKilit } from "./components/SifreKilit";

/* her rotada govde sinifi degisir:
   - /il-panel*, /bakanlik*, /admin*  → sayfa-admin (kenar paneli + govde)
   - /fikir                           → sayfa-fikir (öğrenci fikir hero)
   - diger                            → sayfa-index (anasayfa) */
function GovdeSinifi() {
  const yol = useLocation().pathname;
  useEffect(() => {
    const panelMi =
      yol.startsWith("/il-panel") ||
      yol.startsWith("/bakanlik") ||
      yol.startsWith("/admin");
    if (panelMi) {
      document.body.className = "sayfa-admin";
    } else if (yol.startsWith("/fikir")) {
      document.body.className = "sayfa-fikir";
    } else {
      document.body.className = "sayfa-index";
    }
  }, [yol]);
  return null;
}

/* Sprint 11.65 (Onur) — UstBar (üst logo + slogan + MEB logosu) YALNIZCA
   anasayfa ve /fikir'de gösterilir. Diğer tüm sayfalarda gereksiz yer
   kaplıyordu: /admin, /mfa-setup, /mfa-login, /sifre-degistir,
   /sifremi-unuttum, /sifre-sifirla. Paneller zaten kendi kenar panelinde
   marka bloğu taşıyor. */
function KosulluUstBar() {
  const yol = useLocation().pathname;
  const genelSayfaMi = yol === "/" || yol.startsWith("/fikir");
  if (!genelSayfaMi) return null;
  return <UstBar />;
}

export default function App() {
  return (
    <UygulamayiSinirla>
    <BrowserRouter>
      <GovdeSinifi />
      <KosulluUstBar />
      <AccessibilityPanel />
      {/* Sprint 11.62 / YG-20 — çıkış butonu her sayfada erişilebilir. */}
      <KullaniciCikis />
      <SifreKilit>
      <Routes>
        {/* Sprint 11.60 / YG-17 — 90 günlük parola süresi dolmuş personel
            uygulamanın tamamına kilitlenir; yalnızca bu ekrana erişebilir. */}
        <Route
          path="/sifre-degistir"
          element={<SifreDegistirPage zorunlu={false} />}
        />
        <Route path="/" element={<HomePage />} />
        {/* Sprint 11.55: bu rota tanımsızdı ve 404 dönüyordu. AdminAuthGuard ve
            şifre sıfırlama ekranları buraya yönlendiriyor. Ana sayfa giriş
            modalı açık halde render edilir. */}
        <Route path="/giris" element={<HomePage />} />
        <Route path="/fikir" element={<FikirPage />} />
        <Route path="/mfa-setup" element={<MfaSetupPage />} />
        <Route path="/mfa-login" element={<MfaLoginPage />} />
        {/* Sprint 11.5 — Şifremi Unuttum akışı (Yetkili Girişi + Öğrenci Girişi modal'larından). */}
        <Route path="/sifremi-unuttum" element={<SifremiUnuttumPage />} />
        <Route path="/sifre-sifirla" element={<SifreSifirlaPage />} />
        <Route element={<ProtectedRoute context="province" />}>
          <Route path="/il-panel" element={<ProvinceInboxPage />} />
          <Route path="/il-panel/adaylar" element={<CandidatesPage />} />
          <Route path="/il-panel/ekip" element={<EkipPage />} />
          <Route path="/il-panel/rapor" element={<ProvinceReportPage />} />
          <Route path="/il-panel/fikir/:id" element={<ApplicationDetailPage />} />
        </Route>
        <Route element={<ProtectedRoute context="ministry" />}>
          <Route path="/bakanlik" element={<MinistryPage gorunum="adaylar" />} />
          <Route path="/bakanlik/donemler" element={<MinistryPage gorunum="donemler" />} />
          <Route path="/admin/kullanicilar" element={<Navigate to="/admin/users" replace />} />
          {/* Sprint 11 — Yeni admin panel route'ları (SystemAdmin zorunlu). */}
          <Route
            path="/admin"
            element={
              <AdminAuthGuard>
                <AdminLayout />
              </AdminAuthGuard>
            }
          >
            {/* Sprint 11.65 (Onur): `/admin` ve `/admin/users` birebir aynı
                ekranı gösteriyordu — iki rota aynı bileşene bağlıydı. Sahte
                sayfa kaldırıldı, `/admin` artık tek yönlendirme noktası. */}
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route path="users" element={<UserListPage />} />
            <Route path="users/bulk" element={<UserBulkPage />} />
            <Route path="users/:id" element={<UserEditPage />} />
            <Route path="oauth" element={<OAuthAyarlaPage />} />
            {/* Sprint 11.61 / YG-13,18 — denetim raporları */}
            <Route path="raporlar" element={<DenetimRaporlariPage />} />
          </Route>
        </Route>
        <Route path="*" element={<SayfaBulunamadi />} />
      </Routes>
      </SifreKilit>
    </BrowserRouter>
    </UygulamayiSinirla>
  );
}

// Genel hata sınırı (YEĞİTEK gereksinim #35): React render hatalarını yakala,
// kullanıcı dostu sayfa göster. PII sızdırma — sadece teknik bilgi gösterilir.
class GenelHataSinir extends Component<{ children: ReactNode }, { hata: Error | null }> {
  state = { hata: null as Error | null };
  static getDerivedStateFromError(hata: Error) { return { hata }; }
  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    // İstemci hatasını konsola yaz (production'da log servisi).
    // eslint-disable-next-line no-console
    console.error("UI render hatası:", hata, bilgi);
  }
  render() {
    if (this.state.hata) return <SunucuHatasi />;
    return this.props.children;
  }
}

function UygulamayiSinirla({ children }: { children: ReactNode }) {
  return <GenelHataSinir>{children}</GenelHataSinir>;
}
