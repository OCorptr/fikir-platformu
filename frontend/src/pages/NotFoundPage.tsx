import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", gap: "0.8rem", justifyItems: "center", textAlign: "center" }}>
      <span style={{ fontSize: "3rem", fontWeight: 900, color: "#16355c" }}>404</span>
      <h1 style={{ color: "#16355c" }}>Bu sayfayı bulamadık</h1>
      <p className="kart-not">Bağlantı değişmiş veya sayfa henüz hazırlanıyor olabilir.</p>
      <Link className="btn-ana" to="/">Ana sayfaya dön</Link>
    </main>
  );
}
