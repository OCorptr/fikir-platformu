import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { UstBar } from "./components/UstBar";
import FikirPage from "./pages/FikirPage";
import { HomePage } from "./pages/HomePage";
import { ProvinceInboxPage } from "./pages/ProvinceInboxPage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { CandidatesPage } from "./pages/CandidatesPage";
import { MinistryPage } from "./pages/MinistryPage";
import { logout, me } from "./services/auth";
import type { MeResponse } from "./types";

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

/* Router context'i içinde çalışan iç bileşen — useLocation burada güvenli. */
function AppIcerik() {
  const yol = useLocation().pathname;
  const adminRota = yol.startsWith("/il-panel") || yol.startsWith("/bakanlik");

  // Üst bar'daki rol bazlı link için tek bir /me çağrısı — sayfalar kendi içlerinde de /me yapar (state bağımsız).
  const [meState, setMeState] = useState<MeResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    me(controller.signal)
      .then(setMeState)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setMeState({ authenticated: false });
        }
      });
    return () => controller.abort();
  }, []);

  const handleLogout = async () => {
    try {
      // ÜstBar yalnız öğrenci sayfalarında (/fikir) görünür — öğrenci context'ini kapat.
      await logout("student");
    } catch {
      // yoksay
    }
    setMeState({ authenticated: false, sessions: [] });
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <>
      <GovdeSinifi />
      {!adminRota && <UstBar me={meState} onLogout={handleLogout} />}
      <AccessibilityPanel />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fikir" element={<FikirPage />} />
        <Route path="/il-panel" element={<ProvinceInboxPage />} />
        <Route path="/il-panel/adaylar" element={<CandidatesPage />} />
        <Route path="/il-panel/fikir/:id" element={<ApplicationDetailPage />} />
        <Route path="/bakanlik" element={<MinistryPage />} />
        <Route path="/bakanlik/uygulamalar" element={<MinistryPage />} />
        <Route path="/bakanlik/:periodId" element={<MinistryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppIcerik />
    </BrowserRouter>
  );
}
