import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicLayout } from "./components/PublicLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

/* her rotada govde sinifi degisir: kimlik sayfalari = sayfa-fikir, digerleri = sayfa-index */
function GovdeSinifi() {
  const yol = useLocation().pathname;
  useEffect(() => {
    const kimlikSayfalari = ["/giris", "/kayit", "/sifremi-unuttum", "/sifre-sifirla"];
    document.body.className = kimlikSayfalari.includes(yol) ? "sayfa-fikir" : "sayfa-index";
  }, [yol]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GovdeSinifi />
        <AccessibilityPanel />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/giris" element={<LoginPage />} />
            <Route path="/kayit" element={<RegisterPage />} />
            <Route path="/sifremi-unuttum" element={<ForgotPasswordPage />} />
            <Route path="/sifre-sifirla" element={<ResetPasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/profil" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
