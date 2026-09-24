import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UstBar } from "./components/UstBar";
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
import { AdminUsersPage } from "./pages/AdminUsersPage";

/* her rotada govde sinifi degisir:
   - /il-panel*, /bakanlik*  → sayfa-admin (sidebar + govde düzeni admin.css'ten)
   - /fikir                  → sayfa-fikir (öğrenci fikir hero)
   - diger                   → sayfa-index (anasayfa) */
function GovdeSinifi() {
  const yol = useLocation().pathname;
  useEffect(() => {
    const adminMi = yol.startsWith("/il-panel") || yol.startsWith("/bakanlik");
    if (adminMi) {
      document.body.className = "sayfa-admin";
    } else if (yol.startsWith("/fikir")) {
      document.body.className = "sayfa-fikir";
    } else {
      document.body.className = "sayfa-index";
    }
  }, [yol]);
  return null;
}

/* UstBar (üst logo + slogan + MEB logosu) yalnizca anasayfa ve /fikir'de gösterilir.
   Admin panellerde (.kenar + .ustbar zaten AdminLayout'ta var) UstBar
   gereksiz yer kaplar ve logonun uzerinde panel durur. */
function KosulluUstBar() {
  const yol = useLocation().pathname;
  const adminMi = yol.startsWith("/il-panel") || yol.startsWith("/bakanlik");
  if (adminMi) return null;
  return <UstBar />;
}

export default function App() {
  return (
    <UygulamayiSinirla>
    <BrowserRouter>
      <GovdeSinifi />
      <KosulluUstBar />
      <AccessibilityPanel />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fikir" element={<FikirPage />} />
        <Route path="/mfa-setup" element={<MfaSetupPage />} />
        <Route path="/mfa-login" element={<MfaLoginPage />} />
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
          <Route path="/admin/kullanicilar" element={<AdminUsersPage />} />
        </Route>
        <Route path="*" element={<SayfaBulunamadi />} />
      </Routes>
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
