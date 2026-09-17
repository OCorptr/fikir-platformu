import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import FikirPage from "./pages/FikirPage";
import { HomePage } from "./pages/HomePage";

/* her rotada govde sinifi degisir: fikir sayfasi = sayfa-fikir, ana sayfa = sayfa-index */
function GovdeSinifi() {
  const yol = useLocation().pathname;
  useEffect(() => {
    document.body.className = yol.startsWith("/fikir") ? "sayfa-fikir" : "sayfa-index";
  }, [yol]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <GovdeSinifi />
      <AccessibilityPanel />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fikir" element={<FikirPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
