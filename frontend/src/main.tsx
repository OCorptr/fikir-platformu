import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
// Sprint 11.64: /admin/* sayfaları İl AR-GE / Bakanlık görsel diline
// taşındı. styles.css'ten SONRA yüklenir; referans bloklara dokunmaz.
import "./admin-theme.css";
// Sprint 11.66: anasayfa altındaki iki giriş noktası (Ayın Fikri Arşivi,
// Yetkili Girişi) ve iki modalın ortak teması. En sona yüklenir.
import "./anasayfa-tema.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Uygulama kök elemanı bulunamadı.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
