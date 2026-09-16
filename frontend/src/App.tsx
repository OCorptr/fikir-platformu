import { BrowserRouter, Route, Routes } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
