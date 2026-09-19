import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { UstBar } from "./components/UstBar";
import FikirPage from "./pages/FikirPage";
import { HomePage } from "./pages/HomePage";
import { ProvinceInboxPage } from "./pages/ProvinceInboxPage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { CandidatesPage } from "./pages/CandidatesPage";
import { me } from "./services/auth";
import type { MeResponse } from "./types";

/* her rotada govde sinifi degisir: fikir sayfasi = sayfa-fikir, ana sayfa = sayfa-index */
function GovdeSinifi() {
  const yol = useLocation().pathname;
  useEffect(() => {
    document.body.className = yol.startsWith("/fikir")
      || yol.startsWith("/il-panel")
      ? "sayfa-fikir"
      : "sayfa-index";
  }, [yol]);
  return null;
}

export default function App() {
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

  return (
    <BrowserRouter>
      <GovdeSinifi />
      <UstBar me={meState} />
      <AccessibilityPanel />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fikir" element={<FikirPage />} />
        <Route path="/il-panel" element={<ProvinceInboxPage />} />
        <Route path="/il-panel/adaylar" element={<CandidatesPage />} />
        <Route path="/il-panel/fikir/:id" element={<ApplicationDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
