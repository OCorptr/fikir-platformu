import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { UstBar } from "./components/UstBar";
import FikirPage from "./pages/FikirPage";
import { HomePage } from "./pages/HomePage";
import { ProvinceInboxPage } from "./pages/ProvinceInboxPage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { CandidatesPage } from "./pages/CandidatesPage";
import { EkipPage } from "./pages/EkipPage";
import { MinistryPage } from "./pages/MinistryPage";
import { ProvinceReportPage } from "./pages/ProvinceReportPage";

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
    <BrowserRouter>
      <GovdeSinifi />
      <KosulluUstBar />
      <AccessibilityPanel />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fikir" element={<FikirPage />} />
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
